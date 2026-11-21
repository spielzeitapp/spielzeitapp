export const GOELSENTAL_TEST_SHOP_ID = '3db6fce2-a4c1-44a5-a333-19d1d4d62e6a';

const kids = ['116', '128', '140', '152', '164'];
const unisex = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
const women = ['Damen S (34/36)', 'Damen M (38/40)', 'Damen L (42/44)', 'Damen XL (46/48)'];

const photo = (file: string) => `https://cdn.jako.com/userdata/dcshop/images/normal/${file}.jpg`;
const source = (path: string) => `https://www.jako.com/de-de/${path}`;

export type JakoShopArticle = {
  id: string;
  name: string;
  category: 'Oberteile' | 'Hosen' | 'Zubehör';
  color: string;
  image: string;
  url: string;
  sizes: string[];
  description?: string;
};

export const jakoShopCatalog: JakoShopArticle[] = [
  {
    id: '6170-114',
    name: 'T-Shirt Dynamic',
    category: 'Oberteile',
    color: 'Rot / Weiß / Dunkelrot',
    image: photo('6170_114'),
    url: source('t-shirt-dynamic-p13950/?color=114'),
    sizes: [...kids, ...unisex, '4XL', ...women],
  },
  {
    id: '8670-114',
    name: 'Ziptop Dynamic',
    category: 'Oberteile',
    color: 'Rot / Weiß / Dunkelrot',
    image: '/vereinsshop/ziptop-nsg-preview.webp',
    url: source('ziptop-dynamic-p13949/?color=114'),
    sizes: [...kids, ...unisex, ...women],
    description: 'Mit kurzem Reißverschluss, NSG-Wappen sowie Aufdrucken von Teamshop Breitler und Zöchling',
  },
  {
    id: '8495-08',
    name: 'Trainingshose Active',
    category: 'Hosen',
    color: 'Schwarz / Weiß',
    image: photo('8495_08_Classic'),
    url: source('trainingshose-active-p437/?color=08'),
    sizes: [...kids, ...unisex],
  },
  {
    id: '4499-800',
    name: 'Sporthose Allround',
    category: 'Hosen',
    color: 'Schwarz',
    image: photo('4499_800'),
    url: source('sporthose-allround-p4848/?color=800'),
    sizes: ['128'],
  },
  {
    id: '1814-103',
    name: 'Rucksack Iconic',
    category: 'Zubehör',
    color: 'Rot / Weinrot',
    image: '/vereinsshop/rucksack-nsg-preview.webp',
    url: source('rucksack-mit-bodenfach-p8037/?color=103'),
    sizes: ['Einheitsgröße'],
    description: 'Mit Bodenfach · ca. 32 Liter · NSG-Wappen oben, Raiffeisenbank Gölsental und Teamshop Breitler vorne',
  },
];
