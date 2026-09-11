// ── PFUMA/INGCEBO UI primitives ────────────────────────────────────────────────────
//
// The shared vocabulary every redesigned screen is built from. Kept in one
// module rather than fifteen one-component files: the set is small, it is
// always imported together, and a single file makes the design system
// readable end-to-end.
//
// Nothing here holds business state. These are presentation primitives —
// data fetching, validation and API calls stay in the feature components
// that already own them.

import React from 'react';
import { ArrowRight, Search, Inbox, Loader2 } from 'lucide-react';

// ── cx ──
// Tiny class joiner. Not worth a dependency; falsy entries drop out so
// conditional classes read cleanly at the call site.
export const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ════════════════════════════════════════════════════════════════════════
   BUTTON
   ════════════════════════════════════════════════════════════════════════ */

const BTN_SIZES = {
  sm: 'text-xs px-3.5 py-2 gap-1.5 rounded-lg',
  md: 'text-sm px-5 py-2.5 gap-2 rounded-xl',
  lg: 'text-[0.9375rem] px-7 py-3.5 gap-2.5 rounded-xl',
};

const BTN_VARIANTS = {
  primary:   'pf-btn-primary',
  secondary: 'pf-btn-secondary',
  ghost:     'bg-transparent text-gray-600 border border-transparent hover:bg-bark-500/6 hover:text-bark-500',
  // For use over photography — frosted, so it reads on any part of an image.
  onImage:   'pf-btn-ghost-light',
  danger:    'bg-red-600 text-white border border-red-600 hover:bg-red-700 hover:border-red-700',
};

/**
 * The product's only button. Renders as <button> by default, or as whatever
 * `as` is given (an <a> for links) so semantics stay correct.
 */
export const Button = React.forwardRef(function Button(
  { as: Tag = 'button', variant = 'primary', size = 'md', icon: Icon, iconRight, loading, className, children, ...rest },
  ref
) {
  return (
    <Tag
      ref={ref}
      className={cx('pf-btn', BTN_VARIANTS[variant], BTN_SIZES[size], className)}
      {...rest}
    >
      {loading
        ? <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin shrink-0" aria-hidden="true" />
        : Icon && <Icon size={size === 'sm' ? 14 : 16} className="shrink-0" aria-hidden="true" />}
      {children}
      {iconRight && <ArrowRight size={size === 'sm' ? 13 : 15} className="shrink-0" aria-hidden="true" />}
    </Tag>
  );
});

/* ════════════════════════════════════════════════════════════════════════
   SURFACES
   ════════════════════════════════════════════════════════════════════════ */

/**
 * A panel. `interactive` adds the 3px lift that means "clickable" everywhere
 * in the product — never add it to a card that does not respond to a click.
 */
export const Card = ({ as: Tag = 'div', tone = 'white', interactive, padded = true, className, children, ...rest }) => (
  <Tag
    className={cx(
      tone === 'white' ? 'pf-card' : 'pf-card-quiet',
      padded && 'p-5 md:p-6',
      interactive && 'pf-lift cursor-pointer text-left w-full',
      className
    )}
    {...rest}
  >
    {children}
  </Tag>
);

/* ════════════════════════════════════════════════════════════════════════
   TYPE
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Section heading with an optional eyebrow and a trailing action. Replaces
 * the ad-hoc `<p class="text-xs uppercase tracking-wide">` + `<h3>`
 * pairs that were repeated across the app at inconsistent sizes.
 */
export const SectionHeading = ({ eyebrow, title, sub, action, light, className, as: Tag = 'h2' }) => (
  <div className={cx('flex items-end justify-between gap-6 flex-wrap', className)}>
    <div className="min-w-0">
      {eyebrow && <p className={light ? 'pf-eyebrow-light mb-2' : 'pf-eyebrow mb-2'}>{eyebrow}</p>}
      <Tag className={cx('pf-display text-xl md:text-2xl', light ? 'text-white' : 'text-gray-900')}>
        {title}
      </Tag>
      {sub && (
        <p className={cx('text-sm mt-2 leading-relaxed pf-measure', light ? 'text-white/70' : 'text-gray-600')}>
          {sub}
        </p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/* ════════════════════════════════════════════════════════════════════════
   STATUS
   ════════════════════════════════════════════════════════════════════════ */

// Muted, warm, and deliberately low-chroma — a page of livestock records
// shows dozens of these at once, and saturated badges turn a data table into
// confetti. Meaning is carried by hue AND wording, never hue alone, which is
// also what makes them legible to colour-blind users.
const BADGE_TONES = {
  healthy:    'bg-green-100  text-green-800  ring-green-300/60',
  review:     'bg-amber-100  text-amber-800  ring-amber-300/60',
  sick:       'bg-red-100    text-red-800    ring-red-300/60',
  quarantine: 'bg-orange-100 text-orange-800 ring-orange-300/60',
  info:       'bg-blue-100   text-blue-800   ring-blue-300/60',
  trade:      'bg-purple-100 text-purple-800 ring-purple-300/60',
  neutral:    'bg-gray-100   text-gray-700   ring-gray-300/60',
};

// Maps the many status strings already flowing from the backend onto the
// seven tones above, so callers can pass a raw value straight through.
const STATUS_TONE = {
  healthy: 'healthy', verified: 'healthy', active: 'healthy', approved: 'healthy',
  cleared: 'healthy', complete: 'healthy', completed: 'healthy', paid: 'healthy',
  pending: 'review', 'under review': 'review', review: 'review', awaiting: 'review',
  submitted: 'review', 'in progress': 'review',
  sick: 'sick', critical: 'sick', rejected: 'sick', overdue: 'sick', failed: 'sick',
  suspended: 'sick', flagged: 'sick',
  quarantine: 'quarantine', quarantined: 'quarantine', isolated: 'quarantine',
  sold: 'trade', listed: 'trade', 'for sale': 'trade',
};

/**
 * @param {string} status  raw status text — matched case-insensitively
 * @param {string} tone    override the derived tone when the wording is
 *                         domain-specific and the map cannot know better
 */
export const StatusBadge = ({ status, tone, icon: Icon, size = 'md', className }) => {
  const key = String(status ?? '').toLowerCase().trim();
  const resolved = tone || STATUS_TONE[key] || 'neutral';
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset whitespace-nowrap',
        size === 'sm' ? 'text-[0.6875rem] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        BADGE_TONES[resolved],
        className
      )}
    >
      {Icon && <Icon size={size === 'sm' ? 10 : 12} aria-hidden="true" />}
      {status}
    </span>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   STATS
   ════════════════════════════════════════════════════════════════════════ */

/**
 * One figure in a dashboard stat row. The number carries the hierarchy —
 * large, tight, dark — while the label stays quiet. Deliberately has no
 * icon chip or coloured tile: five of those in a row is the exact look the
 * redesign is moving away from.
 */
export const StatCard = ({ label, value, sub, trend, tone = 'neutral', onClick, className }) => {
  const Tag = onClick ? 'button' : 'div';
  const alert = tone === 'alert';
  return (
    <Tag
      onClick={onClick}
      className={cx(
        'group relative text-left rounded-2xl px-5 py-5 border transition-colors',
        alert ? 'bg-red-50 border-red-200' : 'bg-white pf-hairline border',
        onClick && 'hover:border-bark-500/35 cursor-pointer',
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">{label}</p>
      <p
        data-tabular
        className={cx(
          'pf-display mt-2.5 text-3xl md:text-[2.125rem]',
          alert ? 'text-red-700' : 'text-gray-900'
        )}
      >
        {value}
      </p>
      {(sub || trend) && (
        <p className={cx('text-xs mt-1.5 font-medium', alert ? 'text-red-600' : 'text-gray-500')}>
          {trend && <span className="font-bold mr-1">{trend}</span>}
          {sub}
        </p>
      )}
      {onClick && (
        <ArrowRight
          size={15}
          aria-hidden="true"
          className="absolute top-5 right-5 text-gray-300 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-bark-500"
        />
      )}
    </Tag>
  );
};

/** A stat row that stays readable from 2-up on a phone to 5-up on a desktop. */
export const StatRow = ({ children, className }) => (
  <div className={cx('grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4', className)}>
    {children}
  </div>
);

/* ════════════════════════════════════════════════════════════════════════
   HERO
   ════════════════════════════════════════════════════════════════════════ */

/**
 * The signature band: full-bleed photography, warm scrim, editorial type.
 *
 * The image is the point — content is held to the left half on desktop so
 * the animals stay visible, and the scrim runs vertically on mobile where a
 * side-weighted gradient would wash out the whole frame.
 *
 * @param {string} image     resolved URL (see theme/imagery.js)
 * @param {string} size      'sm' banner | 'md' dashboard | 'lg' entry screen
 */
export const Hero = ({
  image, alt = '', eyebrow, title, sub, actions, aside, size = 'md', className, children,
}) => {
  const heights = {
    sm: 'min-h-[13.5rem] md:min-h-[16rem]',
    md: 'min-h-[19rem] md:min-h-[22.5rem]',
    lg: 'min-h-[27.5rem] md:min-h-[35rem]',
  };
  return (
    <section className={cx('relative isolate overflow-hidden', heights[size], className)}>
      {/* Photography sits underneath everything, never inside a card. */}
      <img
        src={image}
        alt={alt}
        className="absolute inset-0 w-full h-full pf-photo"
        loading="eager"
        decoding="async"
      />
      <div className="absolute inset-0 pf-scrim" aria-hidden="true" />

      {/* Content and aside share a row rather than the aside being absolutely
          positioned — at narrow desktop widths an absolute aside sat on top
          of the supporting copy. The aside drops out entirely below xl,
          where there is no room for it beside a headline. */}
      <div className="relative h-full flex flex-col justify-end md:justify-center px-6 md:px-10 lg:px-14 py-8 md:py-12">
        <div className="flex items-end justify-between gap-10 w-full">
        <div className="w-full md:max-w-[46rem] lg:max-w-[42rem] min-w-0">
          {eyebrow && <p className="pf-eyebrow-light mb-3 pf-rise">{eyebrow}</p>}
          {title && (
            <h1
              className={cx(
                'pf-display text-white text-balance',
                size === 'lg'
                  ? 'text-[2.25rem] leading-[1.05] sm:text-5xl lg:text-[3.5rem]'
                  : 'text-[1.75rem] sm:text-[2.125rem] lg:text-[2.5rem]'
              )}
              style={{ '--pf-delay': '60ms' }}
            >
              <span className="pf-rise inline-block" style={{ '--pf-delay': '60ms' }}>{title}</span>
            </h1>
          )}
          {sub && (
            <p
              className="mt-4 text-sm md:text-base text-white/80 leading-relaxed max-w-[42rem] pf-rise"
              style={{ '--pf-delay': '140ms' }}
            >
              {sub}
            </p>
          )}
          {actions && (
            <div className="mt-7 flex flex-wrap items-center gap-3 pf-rise" style={{ '--pf-delay': '220ms' }}>
              {actions}
            </div>
          )}
          {children}
        </div>
        {aside && <div className="hidden xl:block shrink-0 pb-1">{aside}</div>}
        </div>
      </div>
    </section>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   FILTERS
   ════════════════════════════════════════════════════════════════════════ */

export const SearchInput = ({ value, onChange, placeholder = 'Search', className, ...rest }) => (
  <div className={cx('relative flex-1 min-w-[12rem]', className)}>
    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
    <input
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-bark-500/12 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:border-bark-500/45 outline-none transition"
      {...rest}
    />
  </div>
);

/** A labelled <select> styled to match SearchInput. */
export const FilterSelect = ({ label, value, onChange, options, className }) => (
  <label className={cx('relative', className)}>
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={onChange}
      className="appearance-none pl-3.5 pr-9 py-2.5 bg-white rounded-xl border border-bark-500/12 text-sm font-semibold text-gray-700 cursor-pointer focus:border-bark-500/45 outline-none transition"
    >
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value;
        const text = typeof o === 'string' ? o : o.label;
        return <option key={val} value={val}>{text}</option>;
      })}
    </select>
    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[0.625rem]" aria-hidden="true">▼</span>
  </label>
);

/** Horizontal row of filter controls. Scrolls sideways on a phone rather
    than wrapping into a tall stack that pushes the data off-screen. */
export const FilterBar = ({ children, className }) => (
  <div className={cx('flex items-center gap-2.5 overflow-x-auto pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
    {children}
  </div>
);

/* ════════════════════════════════════════════════════════════════════════
   STATES
   ════════════════════════════════════════════════════════════════════════ */

export const EmptyState = ({ icon: Icon = Inbox, title, sub, action, className }) => (
  <div className={cx('flex flex-col items-center justify-center text-center px-6 py-14 md:py-20', className)}>
    <div className="w-14 h-14 rounded-2xl bg-cream flex items-center justify-center mb-5">
      <Icon size={22} className="text-bark-400" aria-hidden="true" />
    </div>
    <p className="pf-display text-lg text-gray-900">{title}</p>
    {sub && <p className="text-sm text-gray-500 mt-2 max-w-sm leading-relaxed">{sub}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export const LoadingState = ({ label = 'Loading', rows = 3, className }) => (
  <div className={cx('space-y-3', className)} role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="pf-skeleton h-16 rounded-2xl" aria-hidden="true" />
    ))}
  </div>
);

/** Page-level container. One max-width and one gutter for the whole app. */
export const Container = ({ className, children, wide }) => (
  <div className={cx('mx-auto w-full px-5 md:px-8 xl:px-10', wide ? 'max-w-[1600px]' : 'max-w-[1400px]', className)}>
    {children}
  </div>
);
