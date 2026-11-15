use std::net::TcpStream;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_updater::UpdaterExt;

struct BackendProcess(Arc<Mutex<Option<CommandChild>>>);
struct TunnelProcess(Arc<Mutex<Option<std::process::Child>>>);

#[derive(serde::Serialize)]
struct UpdateMetadata {
    available: bool,
    current_version: String,
    version: String,
    body: Option<String>,
}

#[tauri::command]
async fn check_app_update(app: tauri::AppHandle) -> Result<Option<UpdateMetadata>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;

    if let Some(update) = update {
        Ok(Some(UpdateMetadata {
            available: true,
            current_version: update.current_version.clone(),
            version: update.version.clone(),
            body: update.body.clone(),
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn install_app_update(app: tauri::AppHandle) -> Result<String, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;

    if let Some(update) = update {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.restart();
    } else {
        Err("Aucune mise à jour disponible.".to_string())
    }
}

#[tauri::command]
fn start_cloudflare_tunnel(token: String, state: State<'_, TunnelProcess>) -> Result<String, String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Le jeton de tunnel Cloudflare ne peut pas être vide.".to_string());
    }

    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut child) = *lock {
        if let Ok(None) = child.try_wait() {
            return Ok("Le tunnel est déjà en cours d'exécution.".to_string());
        }
    }

    let child = Command::new("cloudflared")
        .args(["tunnel", "run", "--token", token])
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "L'exécutable 'cloudflared' est introuvable. Installez cloudflared sur votre PC.".to_string()
            } else {
                format!("Erreur lors du démarrage du tunnel: {e}")
            }
        })?;

    *lock = Some(child);
    Ok("Tunnel Cloudflare démarré avec succès.".to_string())
}

#[tauri::command]
fn stop_cloudflare_tunnel(state: State<'_, TunnelProcess>) -> Result<String, String> {
    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = lock.take() {
        let _ = child.kill();
        let _ = child.wait();
        Ok("Tunnel Cloudflare arrêté.".to_string())
    } else {
        Ok("Aucun tunnel n'était actif.".to_string())
    }
}

#[tauri::command]
fn get_tunnel_status(state: State<'_, TunnelProcess>) -> bool {
    if let Ok(mut lock) = state.0.lock() {
        if let Some(ref mut child) = *lock {
            return matches!(child.try_wait(), Ok(None));
        }
    }
    false
}

fn wait_for_server(addr: &str, max_retries: u32, retry_delay: Duration) -> bool {
    for _ in 0..max_retries {
        if TcpStream::connect(addr).is_ok() {
            return true;
        }
        thread::sleep(retry_delay);
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let backend_child_holder = Arc::new(Mutex::new(None));
    let tunnel_child_holder = Arc::new(Mutex::new(None));

    tauri::Builder::default()
        .manage(BackendProcess(backend_child_holder.clone()))
        .manage(TunnelProcess(tunnel_child_holder.clone()))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            check_app_update,
            install_app_update,
            start_cloudflare_tunnel,
            stop_cloudflare_tunnel,
            get_tunnel_status,
        ])
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 1. Resolve application data directory for SQLite & .secret_key
            let data_dir = app.path().app_data_dir()?.join("data");
            std::fs::create_dir_all(&data_dir)?;
            let data_dir_str = data_dir.to_string_lossy().to_string();
            let db_url = format!("sqlite:///{}", data_dir.join("app.db").to_string_lossy());

            // 2. Check if a backend is already running on port 8000 (e.g. during local web dev)
            let is_running = TcpStream::connect("127.0.0.1:8000").is_ok();
            if is_running {
                println!("[Tauri] An active backend server was detected on 127.0.0.1:8000. Reusing it.");
            } else {
                println!("[Tauri] No existing backend found on 127.0.0.1:8000. Spawning PyInstaller sidecar...");
                let sidecar_cmd = app
                    .shell()
                    .sidecar("el-amel-backend")
                    .map_err(|e| format!("Failed to configure sidecar: {e}"))?
                    .env("HOST", "127.0.0.1")
                    .env("PORT", "8000")
                    .env("DATA_DIR", &data_dir_str)
                    .env("DATABASE_URL", &db_url);

                let (mut rx, child) = sidecar_cmd
                    .spawn()
                    .map_err(|e| format!("Failed to spawn sidecar: {e}"))?;

                // Store child handle for clean teardown on exit
                if let Ok(mut guard) = backend_child_holder.lock() {
                    *guard = Some(child);
                }

                // Stream sidecar logs in background thread
                tauri::async_runtime::spawn(async move {
                    while let Some(event) = rx.recv().await {
                        match event {
                            CommandEvent::Stdout(line) => {
                                let text = String::from_utf8_lossy(&line);
                                print!("[Backend] {text}");
                            }
                            CommandEvent::Stderr(line) => {
                                let text = String::from_utf8_lossy(&line);
                                eprintln!("[Backend Error] {text}");
                            }
                            CommandEvent::Error(err) => {
                                eprintln!("[Backend Process Error] {err}");
                            }
                            CommandEvent::Terminated(status) => {
                                eprintln!("[Backend Terminated] status: {:?}", status.code);
                                break;
                            }
                            _ => {}
                        }
                    }
                });

                // Wait for backend to accept connections on port 8000
                wait_for_server("127.0.0.1:8000", 50, Duration::from_millis(100));
            }

            // 4. Setup System Tray
            let open_item = MenuItem::with_id(app, "open", "Ouvrir EL-AMEL LAB", true, None::<&str>)?;
            let update_item = MenuItem::with_id(app, "update", "Vérifier les mises à jour", true, None::<&str>)?;
            let status_item = MenuItem::with_id(
                app,
                "status",
                "État : En ligne (127.0.0.1:8000)",
                false,
                None::<&str>,
            )?;
            let quit_item = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&open_item, &update_item, &status_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .tooltip("EL-AMEL LAB")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "update" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        let state = app.state::<BackendProcess>();
                        if let Ok(mut lock) = state.0.lock() {
                            if let Some(child) = lock.take() {
                                let _ = child.kill();
                            }
                        }
                        let tunnel_state = app.state::<TunnelProcess>();
                        if let Ok(mut lock) = tunnel_state.0.lock() {
                            if let Some(mut child) = lock.take() {
                                let _ = child.kill();
                            }
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
