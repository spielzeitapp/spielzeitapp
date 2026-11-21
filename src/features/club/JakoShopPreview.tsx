import React, { useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, FlaskConical, ShoppingBag, Trash2 } from 'lucide-react';
import { jakoShopCatalog, type JakoShopArticle } from './jakoShopCatalog';

type Filter = 'Alle' | JakoShopArticle['category'];
type CartLine = { article: JakoShopArticle; size: string; quantity: number };
const filters: Filter[] = ['Alle', 'Oberteile', 'Hosen', 'Zubehör'];

export function JakoShopPreview() {
  const [filter, setFilter] = useState<Filter>('Alle');
  const [selected, setSelected] = useState<JakoShopArticle | null>(null);
  const [size, setSize] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notice, setNotice] = useState('');
  const content = useRef<HTMLDivElement>(null);

  function openArticle(article: JakoShopArticle) {
    setSelected(article);
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

  function addToCart(article: JakoShopArticle) {
    if (!article.sizes.includes(size)) return;
    setCart(previous => {
      const sameLine = (line: CartLine) => line.article.id === article.id && line.size === size;
      if (!previous.some(sameLine)) return [...previous, { article, size, quantity: 1 }];
      return previous.map(line => sameLine(line) ? { ...line, quantity: line.quantity + 1 } : line);
    });
    setNotice(`${article.name} · ${size} zum Probe-Warenkorb hinzugefügt.`);
  }

  return <section className="club-shop-trial" aria-label="JAKO-Kollektion">
    <div className="club-shop-trial-note">
      <FlaskConical size={22} />
      <div><strong>Shopvorschau</strong><p>Vereinspreise folgen. Du kannst die Größenauswahl und den Warenkorb ausprobieren.</p></div>
    </div>
    <div ref={content} tabIndex={-1}>
      {selected ? <article className="club-shop-panel">
        <button className="club-shop-trial-back" onClick={backToCatalog}><ArrowLeft size={18} /> Alle Artikel</button>
        <img className="club-shop-trial-detail" src={selected.image} alt={`${selected.name} in ${selected.color}`} />
        <p className="club-shop-eyebrow">JAKO · Art. {selected.id}</p>
        <h2>{selected.name}</h2>
        <p>{selected.color}{selected.description && ` · ${selected.description}`}</p>
        <strong>Vereinspreis folgt</strong>
        <fieldset className="club-shop-trial-sizes">
          <legend>Größe wählen</legend>
          <div>{selected.sizes.map(option => <button key={option} aria-pressed={size === option} onClick={() => { setSize(option); setNotice(''); }}>{option}</button>)}</div>
        </fieldset>
        <button className="club-shop-button" disabled={!size} onClick={() => addToCart(selected)}>Zum Probe-Warenkorb hinzufügen</button>
        <p aria-live="polite">{notice}</p>
        <a href={selected.url} target="_blank" rel="noreferrer">Produktdetails bei JAKO</a>
      </article> : <>
        <h2>JAKO-Kollektion</h2>
        <div className="club-shop-tabs" role="group" aria-label="Artikel filtern">
          {filters.map(option => <button key={option} aria-pressed={filter === option} className={filter === option ? 'club-shop-filter-active' : undefined} onClick={() => setFilter(option)}>{option}</button>)}
        </div>
        <div className="club-shop-grid">
          {jakoShopCatalog.filter(article => filter === 'Alle' || article.category === filter).map(article =>
            <button key={article.id} data-article={article.id} className="club-shop-product" onClick={() => openArticle(article)}>
              <img src={article.image} alt="" loading="lazy" />
              <small>{article.color}</small>
              <strong>{article.name}</strong>
              <small>Vereinspreis folgt</small>
              <span className="club-shop-product-link">Artikel ansehen <ChevronRight size={16} /></span>
            </button>
          )}
        </div>
      </>}
    </div>
    {cart.length > 0 && <article className="club-shop-panel" aria-label="Probe-Warenkorb">
      <h2><ShoppingBag size={22} /> Probe-Warenkorb</h2>
      {cart.map(({ article, size: lineSize, quantity }) => <div className="club-shop-cart-row" key={`${article.id}:${lineSize}`}>
        <span><strong>{quantity} × {article.name}</strong><small>{lineSize}</small></span>
        <button aria-label={`${article.name} · ${lineSize} entfernen`} onClick={() => setCart(previous => previous.filter(line => line.article.id !== article.id || line.size !== lineSize))}><Trash2 size={18} /></button>
      </div>)}
      <p>Deine Auswahl dient zur Vorschau. Bestellungen sind nach der Shopfreigabe möglich.</p>
    </article>}
  </section>;
}
