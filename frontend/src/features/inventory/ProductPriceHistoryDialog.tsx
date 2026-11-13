import { useQuery } from "@tanstack/react-query"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type Product, productsApi } from "@/lib/api/inventory"
import { formatDZD, useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

interface ProductPriceHistoryDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProductPriceHistoryDialog({
  product,
  open,
  onOpenChange,
}: ProductPriceHistoryDialogProps) {
  const { t } = useTranslation()

  const { data: history, isLoading } = useQuery({
    queryKey: queryKeys.products.priceHistory(product?.id ?? ""),
    queryFn: () => productsApi.priceHistory(product!.id),
    enabled: Boolean(product && open),
  })

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("priceHistory")}</DialogTitle>
          <DialogDescription>
            Évolution des prix d'achat pour{" "}
            <strong className="text-foreground">{product.name}</strong> (
            {product.unit}).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Chargement de l'historique...
          </div>
        ) : !history || history.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Aucun historique d'achat enregistré sur des factures pour ce
            produit.
          </div>
        ) : (
          <div className="border rounded-md overflow-x-auto my-2">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Fournisseur</th>
                  <th className="p-2.5">N° Facture</th>
                  <th className="p-2.5 text-right">Quantité</th>
                  <th className="p-2.5 text-right">Prix Unitaire HT</th>
                  <th className="p-2.5 text-right">TVA</th>
                  <th className="p-2.5 text-right">Total TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((item, idx) => (
                  <tr
                    key={`${item.invoice_id}-${idx}`}
                    className="hover:bg-muted/20"
                  >
                    <td className="p-2.5">{item.invoice_date}</td>
                    <td className="p-2.5 font-medium">{item.supplier_name}</td>
                    <td className="p-2.5 font-mono text-muted-foreground">
                      {item.invoice_number}
                    </td>
                    <td className="p-2.5 text-right font-medium">
                      {item.quantity}
                    </td>
                    <td className="p-2.5 text-right font-bold text-foreground">
                      {formatDZD(Number(item.unit_price_excl_tax))}
                    </td>
                    <td className="p-2.5 text-right text-muted-foreground">
                      {item.tva_rate}%
                    </td>
                    <td className="p-2.5 text-right font-bold text-foreground">
                      {formatDZD(Number(item.total_line_incl_tax))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
