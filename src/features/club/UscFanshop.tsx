import React, { useState } from "react";
import { ArrowLeft, Check, Minus, Plus, ShoppingBag, Trash2, Package } from "lucide-react";
import { USC_APP_ICON } from "./uscClub";
import "./uscFanshop.css";

type Product = { id: string; name: string; price: number; category: string; kind: "hoodie" | "shirt" | "scarf"; light?: boolean; sizes: string[] };
const sizes = ["128", "140", "152", "164", "S", "M", "L", "XL"];
const products: Product[] = [
  { id: "hoodie", name: "USC Hoodie", price: 4900, category: "Bekleidung", kind: "hoodie", sizes },
  { id: "jersey", name: "Heimtrikot", price: 3900, category: "Bekleidung", kind: "shirt", light: true, sizes },
  { id: "scarf", name: "Fanschal", price: 1900, category: "Zubehör", kind: "scarf", sizes: ["Einheitsgröße"] },
  { id: "training", name: "Trainingsshirt", price: 2900, category: "Bekleidung", kind: "shirt", sizes },
];
type CartItem = { productId: string; size: string; name: string; number: string; quantity: number };
const money = (cents: number) => new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(cents / 100);

// Deliberate product illustrations: real catalogue photos can replace these once approved.
function ProductArt({ product }: { product: Product }) {
  return <div className={`usc-shop-art usc-shop-art--${product.kind}`}>
    <svg viewBox="0 0 300 270" aria-hidden="true">
      <ellipse cx="150" cy="244" rx="96" ry="9" fill="#000" opacity=".08" />
      {product.kind === "scarf" ? <g transform="rotate(-12 150 130)">
        <path d="M43 86h214v84H43z" fill="#17191d" />
        <path d="M65 86h22v84H65zm149 0h22v84h-22z" fill="#f5f5f5" />
        <text x="150" y="141" textAnchor="middle" fill="white" fontSize="32" fontWeight="900">USC</text>
        {[0, 1, 2, 3, 4, 5].map(i => <path key={i} d={`M${47 + i * 4} 170v18m${190 + i * 4} -18v18`} stroke="#33363c" strokeWidth="3" />)}
      </g> : <g stroke="#45484d" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M106 55 74 67 32 136l39 21 24-34v111h110V123l24 34 39-21-42-69-32-12z" fill={product.light ? "#fafafa" : "#24272c"} />
        <path d="M106 55q44 27 88 0" fill="none" stroke={product.light ? "#24272c" : "#555b63"} strokeWidth="7" />
        {product.kind === "hoodie" ? <>
          <path d="M111 58Q93 11 150 13q57-2 39 45l-39 24z" fill="#1b1e22" />
          <path d="M121 57q29-49 58 0l-29 18z" fill="#111316" />
          <path d="m137 75-3 49m29-49 3 49" stroke="#aeb0b4" strokeWidth="2" />
          <path d="m122 168-14 37h84l-14-37z" fill="#202328" />
        </> : <path d="m76 70-37 63m185-63 37 63" stroke={product.light ? "#24272c" : "#d7d9dc"} strokeWidth="5" />}
        <path d="M96 224h108" stroke={product.light ? "#ddd" : "#34383e"} strokeWidth="5" />
      </g>}
    </svg>
    {product.kind !== "scarf" ? <img className="usc-shop-crest" src={USC_APP_ICON} alt="" /> : null}
  </div>;
}

export function UscFanshop({ onBack }: { onBack: () => void }) {
  const [category, setCategory] = useState("Alle");
  const [product, setProduct] = useState<Product | null>(null);
  const [size, setSize] = useState("");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [notice, setNotice] = useState("");
  const count = cart.reduce((n, item) => n + item.quantity, 0);
  const total = cart.reduce((n, item) => n + products.find(p => p.id === item.productId)!.price * item.quantity, 0);
  const openProduct = (item: Product) => {
    setProduct(item); setSize(item.sizes.length === 1 ? item.sizes[0] : "");
    setName(""); setNumber(""); setNotice(""); setShowCart(false);
  };
  const add = () => {
    if (!product || !product.sizes.includes(size)) return;
    const entry: CartItem = { productId: product.id, size, name: name.trim(), number, quantity: 1 };
    setCart(previous => {
      const index = previous.findIndex(item => item.productId === entry.productId && item.size === entry.size && item.name === entry.name && item.number === entry.number);
      return index < 0 ? [...previous, entry] : previous.map((item, i) => i === index ? { ...item, quantity: Math.min(99, item.quantity + 1) } : item);
    });
    setNotice(`${product.name} wurde zum Warenkorb hinzugefügt.`);
  };
  const back = () => { setNotice(""); if (showCart) setShowCart(false); else if (product) setProduct(null); else onBack(); };
  return <section className="usc-shop" aria-label="USC Fanshop">
    <div className="usc-shop-toolbar">
      <button className="usc-icon-button" onClick={back} aria-label={showCart || product ? "Zurück zum Fanshop" : "Zurück zum Verein"}><ArrowLeft size={21} /></button>
      <span>USC ROHRBACH</span>
      <button className="usc-icon-button usc-shop-basket" aria-label={`Warenkorb, ${count} Artikel`} onClick={() => { setShowCart(true); setNotice(""); }}><ShoppingBag size={21} />{count > 0 ? <b>{count}</b> : null}</button>
    </div>
    <div className="usc-shop-demo"><span>VORSCHAU</span> Beispielprodukte und Beispielpreise. Keine echten Bestellungen.</div>
    {showCart ? <>
      <h1>Dein Warenkorb.</h1><p className="usc-shop-subtitle">Dein Verein. Dein Look.</p>
      {cart.length === 0 ? <div className="usc-shop-empty"><ShoppingBag size={38} /><h2>Noch nichts im Warenkorb</h2><p>Entdecke unsere Beispielkollektion.</p><button className="usc-shop-primary" onClick={() => { setShowCart(false); setProduct(null); }}>Zum Fanshop</button></div> : <>
        <div className="usc-shop-cart-list">{cart.map((item, index) => {
          const p = products.find(candidate => candidate.id === item.productId)!;
          return <article className="usc-shop-cart-item" key={JSON.stringify([item.productId, item.size, item.name, item.number])}>
            <ProductArt product={p} /><div><h2>{p.name}</h2><p>Größe {item.size}</p>{item.name || item.number ? <p>{[item.name, item.number && `Nr. ${item.number}`].filter(Boolean).join(" · ")}</p> : null}<strong>{money(p.price * item.quantity)}</strong>
              <div className="usc-shop-quantity"><button aria-label={`${p.name}: Menge verringern`} disabled={item.quantity <= 1} onClick={() => setCart(previous => previous.map((row, i) => i === index ? { ...row, quantity: row.quantity - 1 } : row))}><Minus size={16} /></button><span>{item.quantity}</span><button disabled={item.quantity >= 99} aria-label={`${p.name}: Menge erhöhen`} onClick={() => setCart(previous => previous.map((row, i) => i === index ? { ...row, quantity: row.quantity + 1 } : row))}><Plus size={16} /></button><button aria-label={`${p.name} entfernen`} onClick={() => setCart(previous => previous.filter((_, i) => i !== index))}><Trash2 size={17} /></button></div>
            </div>
          </article>;
        })}</div>
        <div className="usc-shop-total"><span>Gesamt · Beispielpreis</span><strong>{money(total)}</strong></div>
        <div className="usc-shop-info"><Package size={24} /><div><strong>Geplant: Abholung beim Verein</strong><p>Bestellabwicklung und Bezahlung werden noch eingerichtet. Der Warenkorb dient zum Ausprobieren und bleibt nur während dieses Shopbesuchs erhalten.</p></div></div>
        <button className="usc-shop-primary" disabled>Bestellen bald möglich</button>
      </>}
    </> : product ? <>
      <ProductArt product={product} />
      <div className="usc-shop-product-title"><h1>{product.name}</h1><strong>{money(product.price)}</strong></div>
      <p className="usc-shop-subtitle">{product.light ? "Weiß / Schwarz" : "Schwarz"} · Beispielkollektion</p>
      <fieldset><legend>Größe wählen</legend><div className="usc-shop-sizes">{product.sizes.map(value => <button key={value} aria-pressed={size === value} onClick={() => { setSize(value); setNotice(""); }}>{value}</button>)}</div></fieldset>
      {product.kind !== "scarf" ? <div className="usc-shop-personalize"><label>Wunschname <small>optional · Vorschau</small><input maxLength={24} placeholder="Dein Wunschname" value={name} onChange={event => { setName(event.target.value); setNotice(""); }} /></label><label>Nummer <small>optional</small><input inputMode="numeric" maxLength={2} placeholder="z. B. 10" value={number} onChange={event => { setNumber(event.target.value.replace(/\D/g, "").slice(0, 2)); setNotice(""); }} /></label></div> : null}
      <div className="usc-shop-info"><Package size={24} /><div><strong>Abholung beim Verein vorgesehen</strong><p>Produktbilder und Personalisierung sind Beispiele.</p></div></div>
      <button className="usc-shop-primary" disabled={!size} onClick={add}><ShoppingBag size={21} />{size ? "In den Warenkorb" : "Bitte Größe wählen"}</button>
      <div role="status" className="usc-shop-status">{notice ? <><Check size={18} />{notice}</> : null}</div>
      {notice ? <button className="usc-shop-secondary" onClick={() => setShowCart(true)}>Warenkorb ansehen</button> : null}
    </> : <>
      <h1>Fanshop.</h1><p className="usc-shop-subtitle">Dein Verein. Dein Look.</p>
      <div className="usc-shop-hero"><div><span className="usc-eyebrow">SCHWARZ. WEISS. USC.</span><h2>Unsere Farben.<br />Dein Verein.</h2><span className="usc-shop-hero-tag">Kollektion entdecken</span></div><ProductArt product={products[0]} /></div>
      <div className="usc-shop-categories" aria-label="Produktkategorien">{["Alle", "Bekleidung", "Zubehör"].map(value => <button key={value} aria-pressed={value === category} onClick={() => setCategory(value)}>{value}</button>)}</div>
      <div className="usc-shop-grid">{products.filter(p => category === "Alle" || p.category === category).map(item => <button className="usc-shop-card" key={item.id} onClick={() => openProduct(item)}><ProductArt product={item} /><span className="usc-shop-card-copy"><strong>{item.name}</strong><span>{money(item.price)}</span><small>{item.sizes.length > 1 ? "Kinder- & Erwachsenengrößen" : "Einheitsgröße"}</small></span></button>)}</div>
      <p className="usc-shop-footnote">Entwurf der USC-Kollektion. Sortiment, Fotos und Preise werden vom Verein festgelegt.</p>
    </>}
  </section>;
}
