import { useState, type ReactNode } from 'react';

interface LogoImageProps {
	src: string | null | undefined;
	/** Shown when there is no logo, or when it fails to load (a dead external link). */
	fallback: ReactNode;
	alt?: string;
	className?: string;
}

export default function LogoImage({ src, fallback, alt = '', className }: LogoImageProps) {
	const [failed, setFailed] = useState<string | null>(null);
	if (!src || src === failed) return <>{fallback}</>;
	return <img src={src} alt={alt} className={className} onError={() => setFailed(src)} />;
}
