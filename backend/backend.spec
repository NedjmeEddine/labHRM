# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import os

block_cipher = None

backend_dir = Path(os.path.abspath(SPECPATH))
assets_dir = backend_dir / "app" / "assets"
frontend_dir = backend_dir / "app" / "frontend"

datas = [
    (str(assets_dir), "app/assets"),
]

if frontend_dir.is_dir():
    datas.append((str(frontend_dir), "app/frontend"))

hiddenimports = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan.on",
    "fpdf",
    "pwdlib",
    "pwdlib.hashers.argon2",
    "pwdlib.hashers.bcrypt",
    "argon2",
    "bcrypt",
    "sqlmodel",
    "pydantic",
    "pydantic_settings",
    "app.models",
    "app.api.main",
    "app.services.system",
    "app.services.employees",
    "app.services.absences",
    "app.services.vacations",
    "app.services.payroll",
    "app.services.purchases",
    "app.services.inventory",
    "app.services.csv_export",
    "app.pdf_generator",
]

a = Analysis(
    ['run_server.py'],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'notebook', 'scipy', 'pandas'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='el-amel-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
