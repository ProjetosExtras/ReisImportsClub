import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { StockUrgencyBar } from "./StockUrgencyBar";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export const ProductCard = ({ product, onAddToCart }: ProductCardProps) => {
  return (
    <Card className="overflow-hidden group hover:shadow-elegant transition-all duration-300">
      <div className="aspect-square overflow-hidden">
        <Link to={`/produto/${product.id}`}>
          <img
            src={product.image_url || '/placeholder.svg'}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        </Link>
      </div>
      <div className="p-6">
        <h3 className="font-semibold text-lg mb-2">
          <Link to={`/produto/${product.id}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold bg-gradient-gold bg-clip-text text-transparent">
              R$ {product.price.toFixed(2)}
            </p>
            {/* Urgency bar (force show for any positive stock by setting threshold to current stock) */}
            <StockUrgencyBar remaining={product.stock} threshold={product.stock} className="w-48 mt-2" />
          </div>
          <Button
            variant="gold"
            size="icon"
            onClick={() => onAddToCart(product)}
            disabled={product.stock === 0}
          >
            <ShoppingCart className="h-5 w-5 text-white" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
