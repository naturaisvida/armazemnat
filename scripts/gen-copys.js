// Script para gerar e adicionar as 15 copies faltantes ao copys.js
const fs = require('fs');
const path = require('path');

const CSS = (p) => `<style>
.${p}{--forest:#2c5740;--forest-2:#21452e;--green:#3f7d54;--cta:#2f9e54;--cta-d:#248445;--sage:#eef5ef;--cream:#fff;--ink:#22332a;--muted:#647067;--radius:14px;font-family:'Inter',-apple-system,system-ui,sans-serif;color:var(--ink);line-height:1.62;font-size:17px;background:var(--cream);max-width:920px;margin:0 auto;border-radius:var(--radius);overflow:hidden;box-shadow:0 18px 50px -28px rgba(33,71,46,.45)}
.${p} *{box-sizing:border-box;margin:0;padding:0}
.${p} h1,.${p} h2,.${p} h3{font-family:system-ui,sans-serif;line-height:1.16;font-weight:700;color:var(--ink)}
.${p} .wrap{padding:44px 36px}
@media(max-width:600px){.${p} .wrap{padding:28px 18px}}
.${p} .hero{color:#eef5ef;padding:52px 36px 48px;text-align:center;background:linear-gradient(160deg,var(--green) 0%,var(--forest) 55%,var(--forest-2) 100%)}
.${p} .eyebrow{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.8);margin-bottom:14px}
.${p} .hero h1{font-size:clamp(24px,5vw,36px);color:#fff;margin:0 0 14px}
.${p} .hero p{font-size:16px;color:rgba(238,245,239,.9);max-width:540px;margin:0 auto 28px}
.${p} a.${p}-btn,.${p} .${p}-btn{display:inline-flex !important;align-items:center;justify-content:center;background:#2f9e54 !important;color:#fff !important;font-weight:700;font-size:16px;padding:16px 34px;border-radius:12px !important;border:none !important;cursor:pointer;text-decoration:none !important;box-shadow:0 12px 26px -12px rgba(47,158,84,.75);transition:transform .16s,box-shadow .16s}
.${p} a.${p}-btn:hover{transform:translateY(-2px);background:#248445 !important;color:#fff !important}
.${p} a.${p}-btn:visited{color:#fff !important}
.${p} .bgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:18px;margin:32px 0}
.${p} .bcard{background:var(--sage);border-radius:12px;padding:22px 18px;text-align:center}
.${p} .bcard h3{font-size:15px;font-weight:700;margin-bottom:8px;color:var(--forest)}
.${p} .bcard p{font-size:14px;color:var(--muted);line-height:1.5}
.${p} .sec-title{font-size:22px;font-weight:700;margin-bottom:6px}
.${p} .sec-sub{color:var(--muted);margin-bottom:24px;font-size:15px}
.${p} .ingrs{list-style:none;display:grid;gap:12px}
.${p} .ingrs li{display:flex;gap:14px;align-items:flex-start;padding:16px;background:var(--sage);border-radius:10px;font-size:15px}
.${p} .ingrs li strong{color:var(--forest);display:block;font-size:14px;margin-bottom:3px}
.${p} .steps{display:grid;gap:14px;margin-top:20px}
.${p} .step{display:flex;gap:14px;align-items:flex-start;padding:18px;background:var(--sage);border-radius:12px}
.${p} .snum{flex-shrink:0;width:34px;height:34px;background:var(--green);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
.${p} .stxt strong{display:block;font-size:15px;font-weight:700;margin-bottom:3px;color:var(--forest)}
.${p} .stxt p{font-size:14px;color:var(--muted);margin:0}
.${p} .cta-block{background:linear-gradient(160deg,var(--green) 0%,var(--forest-2) 100%);color:#fff;padding:48px 32px;text-align:center;margin-top:44px;border-radius:14px}
.${p} .cta-block h2{color:#fff;font-size:clamp(20px,4vw,28px);margin-bottom:12px}
.${p} .cta-block p{color:rgba(255,255,255,.85);margin-bottom:26px;font-size:16px;max-width:500px;margin-left:auto;margin-right:auto}
.${p} .badges{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:18px;font-size:13px;font-weight:600;color:rgba(255,255,255,.8)}
.${p} .compliance{background:#f5faf6;border:1px solid #dce8df;border-radius:10px;padding:14px 18px;font-size:12px;color:#647067;line-height:1.6;margin-top:22px}
.${p} .compliance strong{color:#22332a}
</style>`;

const BTN = (p, txt) => `<a href="#" class="${p}-btn">${txt}</a>`;

function make(p, eyebrow, h1, heroDesc, ctaTxt, benefits, ingrs, steps, ctaH, ctaSub) {
  return CSS(p) + `<div class="${p}">
<div class="hero">
  <div class="eyebrow">${eyebrow}</div>
  <h1>${h1}</h1>
  <p>${heroDesc}</p>
  ${BTN(p, ctaTxt)}
</div>
<div class="wrap">
  <h2 class="sec-title">Por que funciona</h2>
  <p class="sec-sub">Formulacao com ativos naturais selecionados</p>
  <div class="bgrid">
    ${benefits.map(([t,d]) => `<div class="bcard"><h3>${t}</h3><p>${d}</p></div>`).join('')}
  </div>
  <h2 class="sec-title" style="margin-top:40px">Ingredientes principais</h2>
  <p class="sec-sub">Ativos naturais de alta qualidade</p>
  <ul class="ingrs">
    ${ingrs.map(([n,d]) => `<li><div><strong>${n}</strong>${d}</div></li>`).join('')}
  </ul>
  <h2 class="sec-title" style="margin-top:40px">Como usar</h2>
  <p class="sec-sub">Simples de incorporar na sua rotina</p>
  <div class="steps">
    ${steps.map(([t,d],i) => `<div class="step"><div class="snum">${i+1}</div><div class="stxt"><strong>${t}</strong><p>${d}</p></div></div>`).join('')}
  </div>
  <div class="cta-block">
    <h2>${ctaH}</h2>
    <p>${ctaSub}</p>
    ${BTN(p, ctaTxt)}
    <div class="badges"><span>30 dias de garantia</span><span>Frete gratis</span><span>Pagamento seguro</span></div>
  </div>
  <div class="compliance"><p><strong>Informacoes importantes:</strong> Este produto e um suplemento alimentar. <strong>Nao e um medicamento</strong> e nao se destina a diagnosticar, tratar, curar ou prevenir qualquer doenca. Resultados podem variar. Consulte um profissional de saude.</p></div>
</div>
</div>`;
}

const entries = {

'insufree': make('ins',
  'ARMAZEM NATURAL',
  'O cuidado metabolico que seu corpo merecia',
  'Formula em gotas com ingredientes da natureza, desenvolvida para quem quer manter o equilibrio metabolico de forma natural e pratica.',
  'Quero meu equilibrio',
  [
    ['Suporte Metabolico','Ingredientes selecionados para auxiliar o funcionamento saudavel do metabolismo.'],
    ['Formula em Gotas','Absorcao pratica e eficiente, sem dificuldade de engolir capsulas.'],
    ['Rotina Simples','Poucas gotas por dia integradas facilmente ao seu dia a dia.']
  ],
  [
    ['Melao de Sao Caetano','Planta tradicional da medicina popular brasileira, conhecida pelo suporte ao equilibrio do organismo.'],
    ['Canela do Ceilao','Especiaria reconhecida ha seculos por suas propriedades funcionais e suporte ao metabolismo saudavel.'],
    ['Berberina','Composto natural obtido de plantas como berberis, amplamente estudado por pesquisadores do mundo todo.']
  ],
  [
    ['Tome as gotas pela manha','Aplique a dose recomendada diretamente na boca ou diluida em agua, antes do cafe da manha.'],
    ['Mantenha a rotina','O uso continuo garante os melhores resultados. Reserve um horario fixo para nao esquecer.'],
    ['Combine com habitos saudaveis','Alimentacao equilibrada e atividade fisica potencializam os efeitos do suplemento.']
  ],
  'Pronto para cuidar do seu equilibrio?',
  'Garanta seu kit com frete gratis e 30 dias para devolver sem perguntas.'
),

'purenex-glico': make('png',
  'ARMAZEM NATURAL',
  'Natureza e ciencia em harmonia',
  'Suplemento em gotas com ativos naturais para quem busca apoio ao equilibrio do organismo de forma gentil e consistente.',
  'Comecar meu cuidado',
  [
    ['Ativos Reconhecidos','Ingredientes com historico de uso na medicina natural de varios paises.'],
    ['Formulacao em Gotas','Pratica, de rapida absorcao e facil de levar para qualquer lugar.'],
    ['Cuidado Continuo','Resultado que se constroi com o uso regular ao longo do tempo.']
  ],
  [
    ['Gymnema Sylvestre','Planta originaria da India, usada na medicina ayurvedica por seculos como suporte ao bem-estar metabolico.'],
    ['Cromio','Mineral essencial que participa de processos importantes do metabolismo de carboidratos e lipidios.'],
    ['Extrato de Mirtilo','Rico em antioxidantes, o mirtilo e valorizado pela ciencia moderna pelos seus compostos bioativos.']
  ],
  [
    ['Dose matinal','Tome as gotas indicadas antes da refeicao principal, diluidas em um copo de agua.'],
    ['Consistencia diaria','Use todos os dias no mesmo horario para manter os niveis estabilizados no organismo.'],
    ['Acompanhe sua evolucao','Mantenha um diario simples para notar as mudancas ao longo das primeiras semanas.']
  ],
  'Comece seu cuidado natural hoje',
  'Frete gratis para todo o Brasil. 30 dias de garantia incondicional.'
),

'pulmoclean': make('plc',
  'ARMAZEM NATURAL',
  'Respire com mais leveza',
  'Formulacao natural com extratos de plantas reconhecidas pelo suporte ao sistema respiratorio e ao bem-estar das vias aereas.',
  'Respirar melhor agora',
  [
    ['Suporte Respiratorio','Ingredientes vegetais com historico de uso para o conforto das vias aereas.'],
    ['Origem Natural','Extratos de plantas cultivadas e processadas com controle de qualidade.'],
    ['Sem Estimulantes','Formula suave, sem substancias que causem dependencia ou efeitos indesejados.']
  ],
  [
    ['Guaco','Planta brasileira amplamente conhecida e usada na medicina popular pelo suporte ao trato respiratorio.'],
    ['Extrato de Eucalipto','Aromatico e refrescante, o eucalipto e valorizado ha seculos pelo conforto que proporciona as vias aereas.'],
    ['Propolis Verde','Produto natural das abelhas, rico em flavonoides e compostos bioativos de amplo reconhecimento cientifico.']
  ],
  [
    ['Tome pela manha','Aplique as gotas recomendadas em agua morna ou cha de ervas logo ao acordar.'],
    ['Repita se necessario','Em periodos de maior necessidade, pode ser utilizado duas vezes ao dia conforme orientacao.'],
    ['Armazene corretamente','Guarde em local fresco e seco, longe da luz solar direta para preservar os ativos.']
  ],
  'Cuide do seu sistema respiratorio',
  'Formula natural, frete gratis e 30 dias de garantia para experimentar sem risco.'
),

'hair-fortin': make('hft',
  'ARMAZEM NATURAL',
  'Nutricao capilar de dentro para fora',
  'Suplemento com vitaminas, minerais e ativos especificos para fortalecer os fios, reduzir a queda e promover cabelos mais saudaveis.',
  'Quero cabelos mais fortes',
  [
    ['Fios Mais Fortes','Nutrientes que chegam ate a raiz para fortalecer a estrutura capilar desde dentro.'],
    ['Queda Reduzida','Ingredientes que auxiliam na saude do couro cabeludo e na fixacao dos fios.'],
    ['Brilho e Vitalidade','Biotina e aminoacidos essenciais para cabelos com mais vida e brilho natural.']
  ],
  [
    ['Biotina (Vitamina B7)','Vitamina do complexo B indispensavel para a saude dos fios, unhas e pele. Amplamente estudada para nutricao capilar.'],
    ['Queratina Hidrolisada','Proteina estrutural que compos os fios de cabelo. A versao hidrolisada tem absorcao facilitada pelo organismo.'],
    ['Zinco e Selenio','Minerais essenciais que participam do crescimento celular e da saude dos foliculos capilares.']
  ],
  [
    ['Tome com agua','Consuma a dose diaria preferencialmente junto com uma refeicao para melhor absorcao.'],
    ['Seja consistente','Resultados capilares exigem tempo. Os primeiros sinais costumam aparecer a partir de 60 dias de uso continuo.'],
    ['Hidrate externamente','Combine o suplemento com hidratacao topica para potencializar os resultados.']
  ],
  'Seus cabelos merecem esse cuidado',
  'Frete gratis. 30 dias de garantia. Resultados que se constroem com consistencia.'
),

'rosa-oriental': make('rso',
  'ARMAZEM NATURAL',
  'O segredo milenar do Oriente para o bem-estar feminino',
  'Formulacao exclusiva com ervas orientais tradicionais, criada para apoiar o equilibrio e a vitalidade da mulher moderna.',
  'Comecar meu cuidado',
  [
    ['Sabedoria Milenar','Ervas usadas por milhares de anos na medicina tradicional do Oriente para o bem-estar feminino.'],
    ['Equilibrio Natural','Formulacao pensada para apoiar o organismo feminino em cada fase do ciclo de vida.'],
    ['Beleza de Dentro','Ativos que trabalham na vitalidade, no humor e na disposicao do dia a dia.']
  ],
  [
    ['Rosa Mosqueta','Rica em acidos graxos essenciais e antioxidantes, valorizada para o bem-estar feminino.'],
    ['Dong Quai','Raiz classica da medicina tradicional chinesa, conhecida como o ginseng feminino pelo uso secular.'],
    ['Gengibre e Curcuma','Raizes com propriedades antioxidantes reconhecidas que complementam a formulacao com suporte ao bem-estar geral.']
  ],
  [
    ['Tome pelas manhas','Ingira a dose diaria com agua em jejum ou junto ao cafe da manha para melhor aproveitamento.'],
    ['Crie uma rotina','Associe o uso a um momento de autocuidado para tornar o habito prazeroso e consistente.'],
    ['Observe sua evolucao','Muitas mulheres percebem mudancas a partir da 3a semana de uso continuo.']
  ],
  'Cuide de voce com o melhor da natureza',
  'Formula inspirada na sabedoria do Oriente. Frete gratis e 30 dias de garantia.'
),

'rejuvita': make('rjv',
  'ARMAZEM NATURAL',
  'Rejuvenescimento que comeca por dentro',
  'Formulacao antioxidante com ativos reconhecidos pela ciencia moderna para apoiar a vitalidade, a aparencia e o bem-estar com o passar dos anos.',
  'Quero rejuvenescer',
  [
    ['Acao Antioxidante','Ingredientes que combatem os radicais livres, principais responsaveis pelo envelhecimento celular precoce.'],
    ['Vitalidade Renovada','Ativos que apoiam a energia celular e a sensacao de disposicao no cotidiano.'],
    ['Pele e Estrutura','Nutrientes que contribuem para a elasticidade, luminosidade e saude da pele.']
  ],
  [
    ['Coenzima Q10','Molecula presente em cada celula do corpo, fundamental para a producao de energia e com forte acao antioxidante.'],
    ['Resveratrol','Polifenol encontrado na uva e no vinho tinto, amplamente estudado por pesquisadores de longevidade no mundo todo.'],
    ['Vitamina C + Vitamina E','Dupla de antioxidantes classicos que trabalham em sinergia para proteger as celulas e apoiar a producao de colageno.']
  ],
  [
    ['Dose noturna','Tome o suplemento a noite, quando o organismo esta em modo de recuperacao e regeneracao celular.'],
    ['Hidratacao abundante','Beba bastante agua ao longo do dia para potencializar a acao dos ativos antioxidantes.'],
    ['Proteja a pele do sol','Combine com protecao solar diaria para resultados amplificados no aspecto da pele.']
  ],
  'O melhor momento para cuidar e agora',
  'Formula antioxidante completa. Frete gratis e 30 dias para experimentar sem risco.'
),

'dura-max': make('drx',
  'ARMAZEM NATURAL',
  'Disposicao e vitalidade masculina com a natureza',
  'Formula masculina com ativos naturais que apoia a energia, o desempenho fisico e o bem-estar do homem ativo.',
  'Quero mais disposicao',
  [
    ['Mais Energia','Ingredientes que auxiliam na producao de energia e na reducao do cansaco fisico e mental.'],
    ['Desempenho Fisico','Ativos classicos do esporte natural para quem quer ir alem nos treinos e no dia a dia.'],
    ['Bem-estar Masculino','Formula pensada especificamente para as necessidades do homem moderno.']
  ],
  [
    ['Maca Peruana','Raiz andina usada por guerreiros incas por sua associacao com energia e resistencia fisica. Rica em aminoacidos.'],
    ['Tribulus Terrestris','Planta amplamente estudada em universidades de varios continentes pelo suporte a vitalidade masculina.'],
    ['Zinco','Mineral essencial para o funcionamento hormonal masculino, o sistema imune e a saude reprodutiva.']
  ],
  [
    ['Tome pela manha','Consuma no cafe da manha para aproveitar o pico de energia ao longo do dia.'],
    ['Associe aos treinos','O suplemento tem maior efeito perceptivel quando combinado com atividade fisica regular.'],
    ['Mantenha por 90 dias','O ciclo completo recomendado e de 3 meses para consolidar os beneficios.']
  ],
  'Sua melhor versao comeca agora',
  'Formula masculina com frete gratis e 30 dias de garantia incondicional.'
),

'viriforte': make('vrf',
  'ARMAZEM NATURAL',
  'Forca e vitalidade masculina com o poder da natureza',
  'Suplemento em gotas com ativos vegetais tradicionais para apoiar a energia, o vigor e o bem-estar masculino.',
  'Quero mais vitalidade',
  [
    ['Vigor Natural','Formula com raizes e ervas reconhecidas pelo suporte a vitalidade e ao desempenho masculino.'],
    ['Ativos em Gotas','Absorcao sublingual rapida, sem depender de agua ou horario de refeicao.'],
    ['Uso Continuo','Resultados que se aprofundam com a consistencia do uso ao longo das semanas.']
  ],
  [
    ['Catuaba','Planta nativa da Mata Atlantica, consagrada na medicina popular brasileira pelo suporte a vitalidade masculina.'],
    ['Ashwagandha','Raiz ayurvedica adaptogenica estudada extensamente por sua relacao com reducao do estresse e energia masculina.'],
    ['Muira Puama','Arvore amazonica conhecida como lignum vitae, com uso secular pelos povos originarios pelo suporte a vitalidade.']
  ],
  [
    ['Gotas sublinguais','Aplique sob a lingua e aguarde 30 segundos antes de engolir para absorcao maxima.'],
    ['Consistencia diaria','Use todos os dias, preferencialmente no mesmo horario, sem pular doses.'],
    ['Ciclo de 60 a 90 dias','Resultados mais profundos aparecem com o uso sustentado ao longo de 2 a 3 meses.']
  ],
  'Sua vitalidade nao precisa de permissao para voltar',
  'Frete gratis, 30 dias de garantia e envio discreto para todo o Brasil.'
),

'elefantol': make('elf',
  'ARMAZEM NATURAL',
  'Potencia e resistencia com ativos da floresta',
  'Formulacao em gotas com poderosos ativos naturais da floresta amazonica e de tradicoes milenares para o homem que quer mais.',
  'Quero meu kit',
  [
    ['Potencia Natural','Ingredientes com uso secular por povos originarios associado a forca e resistencia masculina.'],
    ['Absorcao Rapida','Formula liquida que chega mais rapido ao organismo do que formulas solidas.'],
    ['Origem Controlada','Extratos obtidos com rastreabilidade e controle de pureza.']
  ],
  [
    ['Catuaba Selvagem','Variante silvestre da catuaba, extraida de forma sustentavel da Mata Atlantica brasileira.'],
    ['Muira Puama Concentrada','Extracao concentrada da madeira da arvore amazonica, maximizando os compostos bioativos.'],
    ['Gengibre e Pimenta','Dupla que potencializa a circulacao e complementa a acao dos demais ativos da formula.']
  ],
  [
    ['Dose diaria em gotas','Aplique a dose recomendada diretamente na boca ou em agua, uma vez ao dia.'],
    ['Prefira o periodo noturno','Muitos usuarios preferem tomar a noite, aproveitando o periodo de recuperacao do organismo.'],
    ['Ciclo de 3 meses','Para resultados sustentados, o uso por pelo menos 90 dias e o mais recomendado.']
  ],
  'Potencia que a natureza criou, ciencia que voce merece',
  'Envio discreto para todo o Brasil. 30 dias de garantia sem burocracia.'
),

'burnzine': make('brz',
  'ARMAZEM NATURAL',
  'Acelere seu metabolismo com o poder da natureza',
  'Termogenico natural em capsulas com ingredientes que auxiliam no aumento da temperatura corporal e no suporte ao metabolismo ativo.',
  'Acelerar meu metabolismo',
  [
    ['Termogenese Natural','Ingredientes que elevam levemente a temperatura corporal, auxiliando na queima calorica.'],
    ['Metabolismo Ativo','Ativos que apoiam o funcionamento do metabolismo em ritmo acelerado.'],
    ['Sem Substancias Proibidas','Formula 100% natural, sem anfetaminas, sem diureticos, sem substancias controladas.']
  ],
  [
    ['Pimenta Caiena','Rica em capsaicina, composto responsavel pelo calor e pelo efeito termogenico reconhecido pela ciencia.'],
    ['Cha Verde','Rico em catequinas e cafeina natural, o cha verde e um dos termogenicos mais estudados do mundo.'],
    ['Gengibre Concentrado','Raiz com acoes antioxidantes e termogenicas, que complementa e potencializa os demais ativos da formula.']
  ],
  [
    ['Tome antes das atividades','Consuma 30 minutos antes dos treinos ou do periodo de maior atividade fisica do dia.'],
    ['Beba bastante agua','Termogenicos elevam levemente a temperatura. Hidratacao abundante e fundamental.'],
    ['Evite tomar a noite','Por conter estimulantes naturais, o uso noturno pode interferir no sono.']
  ],
  'Hora de acelerar',
  'Termogenico natural com frete gratis e 30 dias de garantia.'
),

'memoralis': make('mms',
  'ARMAZEM NATURAL',
  'Memoria afiada e foco total com nootropicos naturais',
  'Formula com os melhores nootropicos vegetais para quem quer mais clareza mental, concentracao e desempenho cognitivo.',
  'Quero memoria mais afiada',
  [
    ['Memoria Aprimorada','Ingredientes classicos da medicina natural para o suporte a retencao e recuperacao de informacoes.'],
    ['Foco e Concentracao','Ativos nootropicos que auxiliam na atencao sustentada e na reducao do cansaco mental.'],
    ['Clareza Mental','Formula que apoia a fluidez do pensamento e a rapidez de raciocinio no cotidiano.']
  ],
  [
    ['Bacopa Monnieri','Planta da medicina ayurvedica com dezenas de estudos clinicos sobre memoria e aprendizado. Uso milenar na India.'],
    ['Ginkgo Biloba','Arvore mais antiga do planeta, cujas folhas sao estudadas ha decadas pelo suporte a circulacao cerebral e cognicao.'],
    ['Fosfatidilserina','Fosfolipidio presente naturalmente no cerebro, essencial para a membrana celular neuronal e a comunicacao entre neuronios.']
  ],
  [
    ['Tome pela manha','Nootropicos funcionam melhor quando consumidos no inicio do dia, antes das atividades cognitivas.'],
    ['Evite excesso de cafeina','Combine com consumo moderado de cafe para nao sobrecarregar o sistema nervoso.'],
    ['Ciclo continuo de 60 dias','O Ginkgo e a Bacopa precisam de acumulo no organismo. Resultados surgem gradualmente.']
  ],
  'Seu cerebro merece o melhor',
  'Nootropicos naturais com frete gratis e 30 dias de garantia.'
),

'vision-x': make('vsx',
  'ARMAZEM NATURAL',
  'Cuide dos seus olhos com o poder da natureza',
  'Suplemento especifico para a saude ocular, com luteina, zeaxantina e antioxidantes que protegem a retina e o cristalino.',
  'Quero cuidar da minha visao',
  [
    ['Protecao da Retina','Luteina e zeaxantina acumulam-se na macula, filtrando a luz azul e protegendo as celulas da retina.'],
    ['Antioxidantes Oculares','Vitaminas e minerais que combatem o estresse oxidativo nos tecidos oculares.'],
    ['Apoio ao Cristalino','Nutrientes que contribuem para a manutencao da transparencia do cristalino ao longo dos anos.']
  ],
  [
    ['Luteina','Carotenoide encontrado no espinafre e na couve, concentrado naturalmente na macula do olho. Amplamente estudado para saude ocular.'],
    ['Zeaxantina','Companheira da luteina na macula, filtra radiacao de luz azul antes que chegue a retina.'],
    ['Mirtilo e Vitamina A','O mirtilo e famoso pelo suporte a visao noturna. A vitamina A e essencial para a producao de rodopsina, pigmento da visao.']
  ],
  [
    ['Dose unica diaria','Tome com a refeicao principal, preferencialmente com alguma gordura boa para melhor absorcao dos carotenoides.'],
    ['Proteja seus olhos do sol','Use oculos com protecao UV e associe ao suplemento para protecao completa.'],
    ['Uso preventivo de longo prazo','A saude ocular se constroi ao longo dos anos. O uso continuo e o mais recomendado.']
  ],
  'Seus olhos merecem protecao especial',
  'Formula ocular premium com frete gratis e 30 dias de garantia.'
),

'articuly': make('acy',
  'ARMAZEM NATURAL',
  'Articulacoes flexiveis e movimentos livres',
  'Suplemento com colageno, glucosamina e extratos naturais para quem quer mais mobilidade e conforto articular no dia a dia.',
  'Quero articulacoes flexiveis',
  [
    ['Suporte Articular','Ingredientes que chegam ate a cartilagem e o liquido sinovial para apoiar o conforto nas articulacoes.'],
    ['Flexibilidade','Ativos que contribuem para a manutencao da elasticidade e amplitude de movimento.'],
    ['Recuperacao Pos-Esforco','Formula que apoia a recuperacao das articulacoes apos atividades fisicas intensas.']
  ],
  [
    ['Colageno Tipo II','Proteina especifica da cartilagem articular. O tipo II e o mais indicado para o suporte as articulacoes.'],
    ['Glucosamina e Condroitina','Dupla classica da saude articular, presente naturalmente na cartilagem e estudada extensamente.'],
    ['Boswellia Serrata','Resina extraida de arvore indiana com compostos que apoiam o conforto articular, reconhecidos pela ciencia moderna.']
  ],
  [
    ['Tome com o estomago cheio','O colageno e melhor absorvido junto a uma refeicao com vitamina C. Suco de laranja e um bom acompanhante.'],
    ['Pratique mobilidade','Exercicios suaves de mobilidade articular potencializam os beneficios do suplemento.'],
    ['Ciclo de 90 dias','A regeneracao de cartilagem e lenta. Resultados consistentes aparecem com 3 meses de uso.']
  ],
  'Movimentos livres e articulacoes saudaveis',
  'Frete gratis para todo o Brasil. 30 dias de garantia sem complicacao.'
),

'hemo-gotas': make('hmg',
  'ARMAZEM NATURAL',
  'Suporte ao sangue e circulacao com ferro natural',
  'Formula em gotas com ferro quelato, vitamina B12 e outros ativos para quem quer apoiar a vitalidade, a circulacao e a energia.',
  'Quero melhorar minha circulacao',
  [
    ['Ferro Natural','Ferro quelato de alta biodisponibilidade, melhor absorvido pelo organismo do que o ferro convencional.'],
    ['Circulacao Ativa','Ingredientes que auxiliam na saude do sistema circulatorio e na fluidez do sangue.'],
    ['Mais Energia','O ferro e essencial para o transporte de oxigenio. Niveis adequados se traduzem em mais disposicao.']
  ],
  [
    ['Ferro Bisglicinato','Forma quelada do ferro com alta biodisponibilidade e menor risco de intolerancia gastrica do que outras formas.'],
    ['Vitamina B12','Vitamina essencial para a formacao das celulas do sangue e para o funcionamento do sistema nervoso.'],
    ['Acerola e Vitamina C','A vitamina C amplifica a absorcao do ferro em ate 3 vezes, tornando a formula muito mais eficiente.']
  ],
  [
    ['Tome em jejum','Calcio e cafeina inibem a absorcao do ferro. Idealmente tome de estomago vazio.'],
    ['Espere 2 horas para o cafe','Se beber cafe pela manha, tome o suplemento 2 horas antes ou depois.'],
    ['Combine com vitamina C','Se preferir tomar junto as refeicoes, acompanhe com suco de laranja natural.']
  ],
  'Sua energia vem de dentro',
  'Ferro natural com alta absorcao. Frete gratis e 30 dias de garantia.'
),

'naturion': make('ntn',
  'ARMAZEM NATURAL',
  'Equilibrio mineral que seu corpo precisa todo dia',
  'Eletrolitos e minerais essenciais em gotas para hidratacao celular, equilibrio do organismo e suporte a vitalidade diaria.',
  'Quero meu equilibrio mineral',
  [
    ['Eletrolitos Essenciais','Magnesio, potassio e zinco em forma biodisponivel para reposicao eficiente dos minerais perdidos.'],
    ['Hidratacao Celular','Minerais ionicos que facilitam a entrada de agua para dentro das celulas, otimizando a hidratacao.'],
    ['Equilibrio Vital','Minerais essenciais para mais de 300 reacoes enzimaticas no organismo, do sono a producao de energia.']
  ],
  [
    ['Magnesio Ionico','Forma ionizada de rapida absorcao. O magnesio participa de mais de 300 processos metabolicos no corpo humano.'],
    ['Potassio Natural','Mineral fundamental para o equilibrio hidrico, a funcao muscular e a transmissao nervosa.'],
    ['Zinco e Manganes','Minerais traco essenciais para o sistema imune, a saude hormonal e a atividade enzimatica do organismo.']
  ],
  [
    ['Dilua em agua','Adicione as gotas recomendadas em um copo de agua e beba ao longo do dia.'],
    ['Ideal apos atividades fisicas','Eletrolitos sao perdidos no suor. Tome apos treinos para reposicao rapida.'],
    ['Uso diario continuo','Minerais precisam ser repostos todos os dias. O uso regular garante niveis adequados no organismo.']
  ],
  'Hidratacao e equilibrio mineral todo dia',
  'Formula ionizada com frete gratis e 30 dias de garantia.'
),

};

// Read existing copys.js
const copysPath = path.join(__dirname, '..', 'js', 'copys.js');
let existing = fs.readFileSync(copysPath, 'utf-8');

// Remove closing };
existing = existing.replace(/\n\};\s*$/, '');

// Append new entries
let additions = '';
for (const [slug, html] of Object.entries(entries)) {
  additions += ',\n"' + slug + '": ' + JSON.stringify(html) + '\n';
}

fs.writeFileSync(copysPath, existing + additions + '\n};');
console.log('Adicionados', Object.keys(entries).length, 'produtos ao copys.js');
console.log('Slugs:', Object.keys(entries).join(', '));
