// All static texts of the site live here. Edit and commit to update the site.
// TODO(content): replace placeholders marked «…» with real texts and links.

export const site = {
  name: "«Віка Саксон»",
  shortName: "«Віка»",
  tagline: "Мама, тренерка та коуч. Допомагаю жінкам стати сильнішими — у тіліб ментально й у житті.",
  description:
    "Тренування, коучинг і правильне харчування для жінок і мам. Розклад подій та запис онлайн.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  instagram: { handle: "«instagram_handle»", url: "https://instagram.com/«instagram_handle»" },
  contacts: {
    email: "«vikasakson@gmail.com»",
    phone: "«+380 00 000 00 00»",
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

export const pillars = [
  { title: "Материнство", text: "Як знайти час на себе, коли поруч малеча, і тренуватися без почуття провини." },
  { title: "Фітнес і бодібілдинг", text: "Силові тренування, техніка, прогрес — від перших кроків до сцени." },
  { title: "Харчування", text: "Збалансований раціон без жорстких дієт: схуднення, рельєф, енергія." },
  { title: "Лайфстайл", text: "Режим, сон, звички та мотивація, які тримають результат роками." },
] as const;

export const about = {
  title: "Про мене",
  paragraphs: [
    "«Розкажіть свою історію: як прийшли у спорт, що змінилося після народження дитини.»",
    "«Досвід, сертифікати, досягнення у бодібілдингу та фітнесі.»",
    "«Ваш підхід до тренувань і харчування, кому ви допомагаєте найкраще.»",
  ],
  highlights: [
    { value: "«10+»", label: "років у спорті" },
    { value: "«500+»", label: "клієнток" },
    { value: "«3»", label: "сертифікації" },
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
