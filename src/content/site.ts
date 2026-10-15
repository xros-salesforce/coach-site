// All static texts of the site live here. Edit and commit to update the site.
// TODO(content): replace placeholders marked «…» with real texts and links.
// Until then, pages hide unfinished links and drop unfinished «…» prompts (see isPlaceholder below), and
// `npm run check:content` lists everything still to fill in.

/** True for text that still contains a «…» placeholder. Real copy in this file never uses «». */
export const isPlaceholder = (text: string) => /«[^»]*»/.test(text);

/** Removes «…» prompts from a sentence (for paragraphs that are partly written). */
export const withoutPlaceholders = (text: string) => text.replace(/\s*«[^»]*»/g, "").trim();

export const site = {
  name: "Віка Саксон",
  shortName: "Віка",
  tagline: "Мама, тренерка та коуч. Допомагаю жінкам стати сильнішими — у тілі, ментально й у житті.",
  description:
    "Фітнес-тренерка у Львові: схуднення, фітнес-бікіні, натуральний бодібілдинг. Тренування, коучинг і харчування для жінок і мам. Розклад подій та запис онлайн.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  instagram: { handle: "viktoria_sakson", url: "https://instagram.com/viktoria_sakson" },
  threads: "https://www.threads.com/@viktoria_sakson",
  contacts: {
    email: "«vikasakson@gmail.com»",
    phone: "+380 98 673 40 08",
    telegram: "https://t.me/«telegram»",
    city: "Львів",
  },
} as const;

export const nav = [
  { href: "/", label: "Головна" },
  { href: "/about", label: "Про мене" },
  { href: "/services", label: "Послуги" },
  { href: "/events", label: "Події" },
  { href: "/gallery", label: "Галерея" },
  { href: "/contacts", label: "Контакти" },
] as const;

// Hand-picked Instagram posts (her own phone photos only: no child, no professional shoots).
// Images live in public/images/gallery/<post code>.jpg; most-liked first.
export const gallery = [
  {
    code: "DQ4NabNjaHr",
    alt: "Віка з медаллю чемпіонату WNBF у Польщі",
    href: "https://www.instagram.com/p/DQ4NabNjaHr/",
  },
  {
    code: "DcLzGJvjdBo",
    alt: "Віка на випускному з дипломом",
    href: "https://www.instagram.com/p/DcLzGJvjdBo/",
  },
] as const;

export const pillars = [
  { title: "Материнство", text: "Як знайти час на себе, коли поруч малеча, і тренуватися без почуття провини." },
  { title: "Фітнес і бодібілдинг", text: "Силові тренування, техніка, прогрес — від перших кроків до сцени фітнес-бікіні." },
  { title: "Харчування", text: "Збалансований раціон без жорстких дієт: схуднення, рельєф, енергія." },
  { title: "Лайфстайл", text: "Режим, сон, звички та мотивація, які тримають результат роками." },
] as const;

export const about = {
  title: "Про мене",
  paragraphs: [
    // Facts below are from her Instagram/Threads bio (Oct 2026); expand with her own words.
    "Я — Віка, фітнес-тренерка зі Львова і мама. Мінус 26 кг — мій власний досвід, тож шлях до змін я знаю не з підручників. «Розкажіть, як прийшли у спорт і що змінилося після народження дитини.»",
    "Виступаю у категорії фітнес-бікіні в натуральному бодібілдингу (WNBF). Бронзова призерка міжнародного чемпіонату в Польщі та топ-2 в Україні. «Сертифікати та освіта.»",
    "«Ваш підхід до тренувань і харчування, кому ви допомагаєте найкраще.»",
  ],
  // Her own phone photos (approved; same files as the gallery).
  photos: [
    { src: "/images/gallery/DQ4NabNjaHr.jpg", alt: "Віка з бронзовою медаллю WNBF", caption: "Бронза міжнародного чемпіонату WNBF, Польща" },
  ],
  highlights: [
    { value: "−26 кг", label: "власний результат" },
    { value: "Бронза", label: "міжнародний чемпіонат, Польща" },
    { value: "Топ-2", label: "в Україні, натуральний бодібілдинг" },
  ],
} as const;

export const services = [
  {
    title: "Персональні тренування",
    text: "Індивідуальна програма, контроль техніки, підтримка на кожному етапі.",
    price: "«від 600 грн»",
  },
  {
    title: "Групові тренування",
    text: "Енергія групи та тренування на свіжому повітрі. Можна з дітьми.",
    price: "«від 250 грн»",
  },
  {
    title: "Онлайн-супровід",
    text: "Програма тренувань і харчування, щотижневі звіти, зв'язок у месенджері.",
    price: "«від 2000 грн/міс»",
  },
  {
    title: "План харчування",
    text: "Раціон під вашу ціль, смаки та графік — без голодування.",
    price: "«від 1500 грн»",
  },
  {
    title: "Коучинг",
    text: "Цілі, мотивація, баланс між материнством, роботою та собою.",
    price: "«від 1000 грн»",
  },
] as const;
