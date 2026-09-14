import type { Team } from '@types';

/** Initials stand in where a team has no logo: first letters, at most two. */
function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? '')
		.join('');
}

interface TeamCrestProps {
	team: Pick<Team, 'name' | 'logo' | 'primaryColor'>;
	size?: number;
	className?: string;
}

export default function TeamCrest({ team, size = 34, className = '' }: TeamCrestProps) {
	const color = team.primaryColor || '#0F172A';
	const radius = Math.round(size * 0.24);

	if (team.logo) {
		return (
			<img
				src={team.logo}
				alt=""
				aria-hidden
				className={`shrink-0 object-cover ${className}`}
				style={{ width: size, height: size, borderRadius: radius }}
			/>
		);
	}

	return (
		<span
			aria-hidden
			className={`flex shrink-0 items-center justify-center font-bold text-white ${className}`}
			style={{
				width: size,
				height: size,
				borderRadius: radius,
				backgroundColor: color,
				fontSize: Math.max(9, Math.round(size * 0.34)),
			}}
		>
			{initials(team.name)}
		</span>
	);
}
