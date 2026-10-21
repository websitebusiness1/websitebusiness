import { Link } from 'react-router-dom';
import { config } from '@/config';

const benefits = [
  ['Set up for you', 'After we agree on a package, we create your store and your login. You start with your products, not with settings.'],
  ['Your own look', 'Your logo, banner and colors, so each store reads as its own label and not as a template.'],
  ['Made for phones', 'Shoppers browse, pick a size and check out comfortably on mobile.'],
  ['Payments the way you work', 'Cash on delivery, bank transfer or GCash, set per store. An order stays unpaid until you confirm the money arrived.'],
  ['Stock that stays honest', 'Stock is tracked by size and color, and checkout can’t sell more than you have.'],
  ['Separate by design', 'Each brand sees only its own products, customers and orders.'],
];

const features = [
  ['Product management', ['Upload several photos per piece', 'Set sizes, colors, prices and categories', 'Keep drafts private until you publish']],
  ['Online storefronts', ['A public page for your brand on this platform', 'Search, filters, cart and checkout', 'Colors and banner that match your label']],
  ['Order management', ['See every order with customer and delivery details', 'Update fulfillment as you pack and ship', 'Mark payment received once you’ve checked']],
];

const steps = [
  ['Talk to us', 'Tell us about your brand and what you sell.'],
  ['Agree on a package', 'We settle the details and pricing directly with you. There’s no automatic billing.'],
  ['We set up your store', 'We create your storefront and your private login.'],
  ['Add products and launch', 'Upload your pieces, publish them and start taking orders.'],
];

export default function Home() {
  const { platformName, contactEmail, contactPhone, facebookUrl, instagramUrl } = config;
  const mailto = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(`Store inquiry from my clothing brand`)}`
    : '';
  const hasContact = Boolean(contactEmail || contactPhone || facebookUrl || instagramUrl);

  return (
    <div>
      <header className="border-b border-sand-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="font-display text-2xl">{platformName}</Link>
          <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-4">
            <a href="#features" className="hidden px-2 py-2 text-sand-500 hover:text-black sm:inline">What you get</a>
            <a href="#how-it-works" className="hidden px-2 py-2 text-sand-500 hover:text-black sm:inline">How it works</a>
            <a href="#contact" className="hidden px-2 py-2 text-sand-500 hover:text-black sm:inline">Contact</a>
            <Link to="/login" className="btn-outline">Sign in</Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-sand-200">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pb-24 sm:pt-24">
          <p className="text-sm text-sand-500">For independent clothing brands in the Philippines</p>
          <h1 className="mt-6 font-display text-[clamp(2.9rem,9.5vw,8.25rem)] leading-[0.95] tracking-tight">
            A storefront of your own, without the build.
          </h1>
          <div className="mt-12 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <p className="max-w-xl text-lg leading-relaxed text-sand-700">
              {platformName} gives your label an online store, a private dashboard for products and stock, and order tracking. We set it all up for you.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="#contact" className="btn-primary px-6 py-3.5 text-base">Build Your Clothing Store</a>
              <Link to="/login" className="btn-quiet px-4 py-3.5 text-base">Brand sign in</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="benefits" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <h2 className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">Selling clothes online shouldn’t be a tech project.</h2>
        <dl className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {benefits.map(([title, body]) => (
            <div key={title} className="border-t border-black pt-5">
              <dt className="font-display text-2xl">{title}</dt>
              <dd className="mt-2 max-w-md leading-relaxed text-sand-500">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="features" className="border-y border-sand-200 bg-sand-50">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <h2 className="font-display text-4xl sm:text-5xl">What you get</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {features.map(([title, items]) => (
              <article key={title as string} className="flex flex-col bg-white p-7">
                <h3 className="font-display text-2xl">{title as string}</h3>
                <ul className="mt-5 space-y-3 text-sm leading-relaxed text-sand-700">
                  {(items as string[]).map((i) => (
                    <li key={i} className="flex gap-3">
                      <span aria-hidden className="mt-2 h-px w-4 shrink-0 bg-black" />
                      {i}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <h2 className="font-display text-4xl sm:text-5xl">How it works</h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-4">
          {steps.map(([title, body], i) => (
            <li key={title}>
              <span className="font-display text-5xl text-sand-300">{i + 1}</span>
              <h3 className="mt-3 text-lg font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-sand-500">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="contact" className="bg-black text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:py-28 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl leading-tight sm:text-5xl">Let’s talk about your store.</h2>
            <p className="mt-5 max-w-md leading-relaxed text-white/70">
              Tell us about your brand and what you sell. We’ll reply with a package that fits, and once we agree we set up your store ourselves.
            </p>
          </div>
          <div className="flex flex-col justify-end gap-3 md:items-start">
            {mailto && <a href={mailto} className="inline-flex items-center rounded-[2px] bg-white px-6 py-3.5 font-medium text-black hover:bg-sand-100">Email us at {contactEmail}</a>}
            {contactPhone && <a href={`tel:${contactPhone.replace(/\s+/g, '')}`} className="text-lg underline underline-offset-4">{contactPhone}</a>}
            {(facebookUrl || instagramUrl) && (
              <div className="flex gap-5 text-white/80">
                {facebookUrl && <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Facebook</a>}
                {instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Instagram</a>}
              </div>
            )}
            {!hasContact && <p className="text-white/60">Contact details will appear here soon.</p>}
          </div>
        </div>
      </section>

      <footer className="border-t border-sand-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-sand-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-xl text-black">{platformName}</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#features" className="hover:text-black">What you get</a>
            <a href="#how-it-works" className="hover:text-black">How it works</a>
            <a href="#contact" className="hover:text-black">Contact</a>
            <Link to="/login" className="hover:text-black">Sign in</Link>
            {facebookUrl && <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-black">Facebook</a>}
            {instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-black">Instagram</a>}
          </nav>
          <p>© {new Date().getFullYear()} {platformName}</p>
        </div>
      </footer>
    </div>
  );
}
