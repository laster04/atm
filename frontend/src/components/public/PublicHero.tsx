import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { SportType } from '@types';
import { heroImage } from './hero';

export interface Crumb {
	label: string;
	to?: string;
}

interface PublicHeroProps {
	title: string;
	kicker?: string;
	subtitle?: string;
	crumbs?: Crumb[];
	sport?: SportType | null;
	/** Status pills, counters — anything that belongs beside the title. */
	badge?: React.ReactNode;
	meta?: React.ReactNode;
	actions?: React.ReactNode;
	size?: 'compact' | 'tall';
}

/**
 * The navy band every public page opens with: a sport photograph darkened from
 * the left so the copy keeps its contrast wherever the image is bright.
 */
export default function PublicHero({
	title,
	kicker,
	subtitle,
	crumbs,
	sport,
	badge,
	meta,
	actions,
	size = 'compact',
}: PublicHeroProps) {
	const image = heroImage(sport);

	return (
		<section
			className={`relative overflow-hidden bg-navy ${size === 'tall' ? 'min-h-[380px]' : 'min-h-[240px]'}`}
		>
			<picture>
				<source media="(max-width: 640px)" srcSet={image.srcSmall} />
				<img
					src={image.src}
					alt=""
					aria-hidden
					className="absolute inset-0 size-full object-cover"
					style={{ objectPosition: '55% 55%' }}
				/>
			</picture>
			{/* Dark on the left where the words are, clear on the right where the
			    photograph's subject is. */}
			<div
				className="absolute inset-0"
				style={{
					background:
						'linear-gradient(100deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.85) 42%, rgba(15,23,42,0.35) 78%, rgba(15,23,42,0.15) 100%)',
				}}
			/>
			<div
				className={`relative mx-auto flex max-w-[1600px] flex-col gap-3.5 px-4 sm:px-8 ${
					size === 'tall' ? 'pb-12 pt-28 sm:pt-36' : 'pb-8 pt-8 sm:pt-10'
				}`}
			>
				{crumbs && crumbs.length > 0 && (
					<nav className="flex flex-wrap items-center gap-1.5 text-xs text-white/55">
						{crumbs.map((crumb, index) => (
							<span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
								{crumb.to ? (
									<Link to={crumb.to} className="text-white/55 hover:text-white">{crumb.label}</Link>
								) : (
									<span className="text-white/85">{crumb.label}</span>
								)}
								{index < crumbs.length - 1 && <ChevronRight className="size-3" />}
							</span>
						))}
					</nav>
				)}

				{kicker && (
					<div className="text-xs font-bold uppercase tracking-[0.08em] text-brand">{kicker}</div>
				)}

				<div className="flex flex-wrap items-center gap-4">
					<h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-[42px]">
						{title}
					</h1>
					{badge}
				</div>

				{subtitle && (
					<p className="max-w-xl text-[15px] leading-relaxed text-white/75 sm:text-base">{subtitle}</p>
				)}

				{meta && <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/85">{meta}</div>}
				{actions && <div className="mt-1 flex flex-wrap items-center gap-3">{actions}</div>}
			</div>
		</section>
	);
}
