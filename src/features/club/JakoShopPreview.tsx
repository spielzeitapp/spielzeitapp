import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, ChevronRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { jakoShopCatalog, type JakoShopArticle } from './jakoShopCatalog';

type Filter = 'Alle' | JakoShopArticle['category'];
type CartLine = { article: JakoShopArticle; size: string; quantity: number; child: string };
type OrderStep = 'shop' | 'cart' | 'review' | 'done';
const money = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });
const demoChildren = ['Beispielkind 1', 'Beispielkind 2'];
const filters: Filter[] = ['Alle', 'Oberteile', 'Hosen', 'Zubehör'];

export function ShopCartHeader({ target, count, active, onOpen }: {
  target: HTMLElement;
  count: number;
  active?: boolean;
  onOpen: () => void;
}) {
  return createPortal(
    <button type="button" className="public-market-shop-cart" aria-label={`Warenkorb, ${count} Artikel`}
      aria-current={active ? 'page' : undefined} title="Warenkorb" onClick={onOpen}>
      <ShoppingBag size={21} aria-hidden="true" />
      {count > 0 && <span className="public-market-shop-cart-count" aria-hidden="true">{count}</span>}
    </button>,
    target,
  );
}

export function JakoShopPreview({ cartHeader }: { cartHeader?: HTMLElement | null }) {
  const [filter, setFilter] = useState<Filter>('Alle');
  const [selected, setSelected] = useState<JakoShopArticle | null>(null);
  const [size, setSize] = useState('');
  const [child, setChild] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [step, setStep] = useState<OrderStep>('shop');
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [notice, setNotice] = useState('');
  const content = useRef<HTMLDivElement>(null);

  function openArticle(article: JakoShopArticle) {
    setSelected(article);
    setChild('');
    setSize(article.sizes.length === 1 ? article.sizes[0] : '');
    setNotice('');
    requestAnimationFrame(() => content.current?.focus());
  }

  function backToCatalog() {
    const articleId = selected?.id;
    setSelected(null);
    setNotice('');
    requestAnimationFrame(() => content.current?.querySelector<HTMLButtonElement>(`[data-article="${articleId}"]`)?.focus());
  }

  const itemCount = cart.reduce((count, line) => count + line.quantity, 0);
  const supportUsed = new Set<string>();
  const pricedCart = cart.map(line => {
    const supportedPrice = line.article.previewSupportedPriceCents;
    const eligible = line.child === demoChildren[0] && supportedPrice !== undefined;
    const discount = eligible && !supportUsed.has(line.child)
      ? line.article.previewPriceCents - supportedPrice
      : 0;
    if (discount > 0) supportUsed.add(line.child);
    return { line, discount, total: line.article.previewPriceCents * line.quantity - discount };
  });
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.article.previewPriceCents, 0);
  const support = pricedCart.reduce((sum, row) => sum + row.discount, 0);
  const total = subtotal - support;
  const format = (cents: number) => money.format(cents / 100);

  function goTo(next: OrderStep) {
    setStep(next);
    requestAnimationFrame(() => {
      content.current?.focus({ preventScroll: true });
      content.current?.scrollIntoView({ block: 'start' });
    });
  }

  function addToCart(article: JakoShopArticle) {
    if (!article.sizes.includes(size) || (article.previewSupportedPriceCents !== undefined && !child)) return;
    setCart(previous => {
      const sameLine = (line: CartLine) => line.article.id === article.id && line.size === size && line.child === child;
      if (!previous.some(sameLine)) return [...previous, { article, size, child, quantity: 1 }];
      return previous.map(line => sameLine(line) ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line);
    });
    setNotice(`${article.name} · ${size} zum Probe-Warenkorb hinzugefügt.`);
  }

  function changeQuantity(line: CartLine, quantity: number) {
    setCart(previous => quantity === 0
      ? previous.filter(item => item !== line)
      : previous.map(item => item === line ? { ...item, quantity } : item));
  }

  function confirmOrder() {
    if (step !== 'review' || itemCount === 0) return;
    setConfirmedTotal(total);
    setCart([]);
    setSelected(null);
    setNotice('');
    goTo('done');
  }

  return <section className="club-shop-trial" aria-label="JAKO-Kollektion">
    {cartHeader && <ShopCartHeader target={cartHeader} count={itemCount} active={step === 'cart'} onOpen={() => goTo('cart')} />}
    <div ref={content} tabIndex={-1}>
      {step === 'shop' && <>
        {!cartHeader && <button type="button" className="club-shop-trial-back" onClick={() => goTo('cart')}>
          <ShoppingBag size={18} /> Probe-Warenkorb ({itemCount})
        </button>}
        {selected ? <article className="club-shop-panel">
          <button className="club-shop-trial-back" onClick={backToCatalog}><ArrowLeft size={18} /> Alle Artikel</button>
          <img className="club-shop-trial-detail" src={selected.image} alt={`${selected.name} in ${selected.color}`} />
          <p className="club-shop-eyebrow">JAKO · Art. {selected.id}</p>
          <h2>{selected.name}</h2>
          <p>{selected.color}{selected.description && ` · ${selected.description}`}</p>
          <p className="club-shop-muted">Beispielpreise für TEST</p>
          <strong>{money.format(selected.previewPriceCents / 100)} regulär</strong>
          {selected.previewSupportedPriceCents !== undefined && <>
            <p>{money.format(selected.previewSupportedPriceCents / 100)} mit voller Jahresunterstützung</p>
            <label>Für welches Kind?
              <select value={child} onChange={event => { setChild(event.target.value); setNotice(''); }}>
                <option value="">Beispielkind wählen</option>
                <option value={demoChildren[0]}>{demoChildren[0]} · volle Unterstützung</option>
                <option value={demoChildren[1]}>{demoChildren[1]} · Unterstützung bereits genutzt</option>
              </select>
            </label>
            {child && <p aria-live="polite"><strong>Preis für dieses Kind: {format(child === demoChildren[0] && !supportUsed.has(child) ? selected.previewSupportedPriceCents : selected.previewPriceCents)}</strong></p>}
          </>}
          {selected.sizes.length === 1 ? <p>Größe · {size}</p> : <label>
            Größe
            <select value={size} onChange={event => { setSize(event.target.value); setNotice(''); }}>
              <option value="">Bitte Größe wählen</option>
              {selected.sizes.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>}
          <button className="club-shop-button" disabled={!size || (selected.previewSupportedPriceCents !== undefined && !child)} onClick={() => addToCart(selected)}>Zum Probe-Warenkorb hinzufügen</button>
          <p aria-live="polite">{notice}</p>
          {notice && <button className="club-shop-trial-back" onClick={() => goTo('cart')}>Zum Warenkorb <ChevronRight size={18} /></button>}
          <a href={selected.url} target="_blank" rel="noreferrer">Produktdetails bei JAKO</a>
        </article> : <>
          <p className="club-shop-muted club-shop-preview-status">Shopvorschau · Beispielpreise</p>
          <div className="club-shop-tabs" role="group" aria-label="Artikel filtern">
            {filters.map(option => <button key={option} aria-pressed={filter === option} className={filter === option ? 'club-shop-filter-active' : undefined} onClick={() => setFilter(option)}>{option}</button>)}
          </div>
          <div className="club-shop-grid">
            {jakoShopCatalog.filter(article => filter === 'Alle' || article.category === filter).map(article =>
              <button key={article.id} data-article={article.id} className="club-shop-product" onClick={() => openArticle(article)}>
                <img src={article.image} alt="" loading="lazy" />
                <small>{article.color}</small>
                <strong>{article.name}</strong>
                <span>{money.format(article.previewPriceCents / 100)}</span>
                {article.previewSupportedPriceCents !== undefined && <small>{money.format(article.previewSupportedPriceCents / 100)} mit voller Unterstützung</small>}
                <span className="club-shop-product-link">Artikel ansehen <ChevronRight size={16} /></span>
              </button>
            )}
          </div>
        </>}
      </>}
      {(step === 'cart' || step === 'review') && <article className="club-shop-panel">
        <button className="club-shop-trial-back" onClick={() => goTo(step === 'review' ? 'cart' : 'shop')}>
          <ArrowLeft size={18} /> {step === 'review' ? 'Zum Warenkorb' : 'Weiter einkaufen'}
        </button>
        <h2>{step === 'review' ? 'Bestellung prüfen' : 'Probe-Warenkorb'}</h2>
        {itemCount === 0 ? <p>Dein Probe-Warenkorb ist leer.</p> : <>
          {pricedCart.map(({ line, discount, total: lineTotal }) => <div className="club-shop-cart-row" key={`${line.article.id}:${line.size}:${line.child}`}>
            <span>
              <strong>{line.quantity} × {line.article.name}</strong>
              <small>{line.size}{line.child && ` · ${line.child}`}</small>
              <small>{format(lineTotal)}{discount > 0 && ' · mit Unterstützung'}</small>
            </span>
            {step === 'cart' && <>
              <button aria-label={`Weniger ${line.article.name}`} disabled={line.quantity === 1} onClick={() => changeQuantity(line, line.quantity - 1)}><Minus size={16} /></button>
              <button aria-label={`Mehr ${line.article.name}`} disabled={line.quantity === 99} onClick={() => changeQuantity(line, line.quantity + 1)}><Plus size={16} /></button>
              <button aria-label={`${line.article.name} entfernen`} onClick={() => changeQuantity(line, 0)}><Trash2 size={16} /></button>
            </>}
          </div>)}
          <div className="club-shop-row"><span>Warenwert</span><span>{format(subtotal)}</span></div>
          {support > 0 && <div className="club-shop-row"><span>Vereinsunterstützung</span><span>−{format(support)}</span></div>}
          <div className="club-shop-row"><strong>Beispielsumme</strong><strong>{format(total)}</strong></div>
          {step === 'review' && <p>Sammelbestellung · Vorauskassa und Abholung beim Verein. Für diese Testbestellung fällt keine Zahlung an.</p>}
          <button className="club-shop-button" onClick={step === 'cart' ? () => goTo('review') : confirmOrder}>
            {step === 'cart' ? 'Weiter zur Bestellübersicht' : 'Testbestellung abschließen'}
          </button>
        </>}
      </article>}
      {step === 'done' && <article className="club-shop-panel" role="status">
        <Check size={24} />
        <h2>Testbestellung abgeschlossen</h2>
        <p>Beispielsumme {format(confirmedTotal)}. Es wurde keine echte Bestellung ausgelöst.</p>
        <button className="club-shop-button" onClick={() => goTo('shop')}>Zurück zum Shop</button>
      </article>}
    </div>
  </section>;
}
