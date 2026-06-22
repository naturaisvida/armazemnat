const fs   = require('fs');
const path = require('path');

let _base;
function base() {
  if (!_base) _base = fs.readFileSync(path.join(process.cwd(), 'produto.html'), 'utf-8');
  return _base;
}

const ORIGIN = 'https://armazemnatural.shop';

const META = [
  { slug:'glicofit',          titulo:'Glicofit',                         desc:'Suplemento natural em gotas para equilibrio glicemico',               img:'/img/produtos/glicofit/1.png',           preco:'189.90' },
  { slug:'insufree',          titulo:'Insufree',                         desc:'Formula natural para suporte metabolico e glicemico',                  img:'/img/produtos/insufree/1.png',           preco:'189.90' },
  { slug:'purenex-glico',     titulo:'Purenex Glico',                    desc:'Controle glicemico com ingredientes da natureza',                      img:'/img/produtos/purenex-glico/1.png',      preco:'189.90' },
  { slug:'pulmoclean',        titulo:'Pulmoclean',                       desc:'Suporte respiratorio com ingredientes naturais',                       img:'/img/produtos/pulmoclean/1.png',         preco:'189.90' },
  { slug:'dht-blocker',       titulo:'DHT Blocker',                      desc:'Bloqueador natural de DHT para saude capilar masculina',               img:'/img/produtos/dht-blocker/1.png',        preco:'189.90' },
  { slug:'hair-fortin',       titulo:'Hair Fortin',                      desc:'Nutricao capilar intensiva de dentro para fora',                       img:'/img/produtos/hair-fortin/1.png',        preco:'189.90' },
  { slug:'long-beauty',       titulo:'Long Beauty',                      desc:'Beleza e vitalidade capilar com a forca da natureza',                  img:'/img/produtos/long-beauty/1.png',        preco:'189.90' },
  { slug:'rosa-oriental',     titulo:'Rosa Oriental',                    desc:'Beleza e bem-estar feminino com ervas do Oriente',                     img:'/img/produtos/rosa-oriental/1.png',      preco:'189.90' },
  { slug:'rejuvita',          titulo:'Rejuvita',                         desc:'Antienvelhecimento e rejuvenescimento com ativos naturais',             img:'/img/produtos/rejuvita/1.png',           preco:'189.90' },
  { slug:'meno-care',         titulo:'Meno Care',                        desc:'Suporte natural para os sintomas da menopausa',                        img:'/img/produtos/meno-care/1.png',          preco:'189.90' },
  { slug:'dura-max',          titulo:'DuraMax',                          desc:'Formula masculina para disposicao e vitalidade',                       img:'/img/produtos/dura-max/1.png',           preco:'109.90' },
  { slug:'viriforte',         titulo:'Viriforte',                        desc:'Forca e vitalidade masculina com a natureza',                          img:'/img/produtos/viriforte/1.png',          preco:'189.90' },
  { slug:'elefantol',         titulo:'Elefantol',                        desc:'Potencia e resistencia com ativos naturais',                           img:'/img/produtos/elefantol/1.png',          preco:'189.90' },
  { slug:'mounjax',           titulo:'Mounjax',                          desc:'Suporte ao emagrecimento com ingredientes naturais',                   img:'/img/produtos/mounjax/1.png',            preco:'189.90' },
  { slug:'burnzine',          titulo:'Burnzine',                         desc:'Termogenico natural para acelerar o metabolismo',                      img:'/img/produtos/burnzine/1.png',           preco:'189.90' },
  { slug:'neurovex',          titulo:'Neurovex',                         desc:'Suporte cognitivo e neurologico com nootropicos naturais',              img:'/img/produtos/neurovex/1.png',           preco:'189.90' },
  { slug:'memoralis',         titulo:'Memoralis',                        desc:'Memoria e concentracao com nootropicos naturais',                      img:'/img/produtos/memoralis/1.png',          preco:'189.90' },
  { slug:'nervomax',          titulo:'Nervomax',                         desc:'Saude do sistema nervoso com ingredientes naturais',                   img:'/img/produtos/nervomax/1.png',           preco:'189.90' },
  { slug:'vision-x',          titulo:'Vision-X',                         desc:'Saude ocular com luteina e zeaxantina naturais',                       img:'/img/produtos/vision-x/1.png',           preco:'189.90' },
  { slug:'articuly',          titulo:'Articuly',                         desc:'Articulacoes flexiveis com colageno e ativos naturais',                 img:'/img/produtos/articuly/1.png',           preco:'189.90' },
  { slug:'hemo-gotas',        titulo:'Hemo Gotas',                       desc:'Suporte ao sangue e circulacao com ferro natural',                     img:'/img/produtos/hemo-gotas/1.png',         preco:'189.90' },
  { slug:'prostavex',         titulo:'Prostavex',                        desc:'Saude da prostata com saw palmetto e zinco',                           img:'/img/produtos/prostavex/1.png',          preco:'189.90' },
  { slug:'mitocondril',       titulo:'Mitocondril',                      desc:'Energia celular profunda com CoQ10 e ativos mitocondriais',             img:'/img/produtos/mitocondril/1.png',        preco:'189.90' },
  { slug:'akkermat',          titulo:'Akkermat',                         desc:'Microbiota intestinal com Akkermansia e probioticos naturais',          img:'/img/produtos/akkermat/1.png',           preco:'189.90' },
  { slug:'naturion',          titulo:'Naturion',                         desc:'Equilibrio mineral e vital com eletrolitos naturais',                  img:'/img/produtos/naturion/1.png',           preco:'189.90' },
  { slug:'urocianina',        titulo:'Urocianina',                       desc:'Suporte natural para o trato urinario com cranberry',                  img:'/img/produtos/urocianina/1.png',         preco:'189.90' },
  { slug:'artivita',          titulo:'Artivita',                         desc:'Suporte natural para articulacoes e mobilidade',                       img:'/img/produtos/artivita/1.png',           preco:'149.90' },
  { slug:'corretor-postural', titulo:'Corretor Postural Ombro e Lombar', desc:'Corretor postural 3 em 1 para coluna, ombros e lombar',                img:'/img/produtos/corretor-postural/1.webp', preco:'129.90' },
  { slug:'teste',             titulo:'Produto Teste',                    desc:'Produto interno para testes de pagamento',                             img:'/img/produtos/glicofit/1.png',           preco:'10.00' },
];

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

module.exports = (req, res) => {
  const slug = String(req.query.slug || '').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  const prod = META.find(p => p.slug === slug);

  if (!prod) {
    res.redirect(302, '/');
    return;
  }

  const url    = ORIGIN + '/products/' + slug;
  const title  = prod.titulo + ' | Comprar com Desconto | Armazem Natural';
  const desc   = prod.desc + ' | Frete Gratis | Ate 69% OFF';
  const imgUrl = ORIGIN + prod.img;

  const ldJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type':       'Product',
        name:          prod.titulo,
        description:   prod.desc,
        image:         [imgUrl],
        brand:         { '@type': 'Brand', name: 'Armazem Natural' },
        offers: {
          '@type':       'Offer',
          priceCurrency: 'BRL',
          price:         prod.preco,
          availability:  'https://schema.org/InStock',
          url,
          seller:        { '@type': 'Organization', name: 'Armazem Natural' },
        },
        aggregateRating: {
          '@type':      'AggregateRating',
          ratingValue:  '4.8',
          reviewCount:  '5000',
          bestRating:   '5',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio',    item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: prod.titulo, item: url },
        ],
      },
    ],
  });

  const html = base()
    .replace(/<title id="pg-title">[^<]*<\/title>/,
      `<title id="pg-title">${esc(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+id="pg-desc"\s+content=")[^"]*(")/,
      `$1${esc(desc)}$2`)
    .replace(/(<link\s+id="pg-canonical"\s+rel="canonical"\s+href=")[^"]*(")/,
      `$1${esc(url)}$2`)
    .replace(/(<meta\s+id="og-title"[^>]*content=")[^"]*(")/,
      `$1${esc(title)}$2`)
    .replace(/(<meta\s+id="og-desc"[^>]*content=")[^"]*(")/,
      `$1${esc(desc)}$2`)
    .replace(/(<meta\s+id="og-image"[^>]*content=")[^"]*(")/,
      `$1${esc(imgUrl)}$2`)
    .replace(/(<meta\s+id="og-url"[^>]*content=")[^"]*(")/,
      `$1${esc(url)}$2`)
    .replace(/(<meta\s+id="og-prc"[^>]*content=")[^"]*(")/,
      `$1${prod.preco}$2`)
    .replace(/<script id="ld-json" type="application\/ld\+json"><\/script>/,
      `<script id="ld-json" type="application/ld+json">${ldJson}<\/script>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.send(html);
};
