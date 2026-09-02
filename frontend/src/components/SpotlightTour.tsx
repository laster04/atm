import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/base/button';

export interface TourStep {
  target: string | null;
  titleKey: string;
  bodyKey: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(selector: string | null): Rect | null {
  if (!selector) return null;
  const candidates = document.querySelectorAll(`[data-tour="${selector}"]`);
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }
  }
  return null;
}

interface SpotlightTourProps {
  steps: TourStep[];
  eligible: boolean;
  onFinish: () => void;
}

export default function SpotlightTour({ steps: allSteps, eligible, onFinish }: SpotlightTourProps) {
  const { t } = useTranslation();

  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!eligible || dismissed) return;
    const timer = setTimeout(() => {
      setSteps(allSteps.filter((s) => measure(s.target) !== null));
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, dismissed]);

  const active = eligible && !dismissed && !!steps && steps.length > 0;

  useEffect(() => {
    if (!active || !steps) return;

    const step = steps[index];
    const el = step?.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const update = () => setRect(measure(step?.target ?? null));
    const t1 = setTimeout(update, 350);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      clearTimeout(t1);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index]);

  if (!active || !steps) return null;

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const finish = () => {
    setDismissed(true);
    onFinish();
  };

  const next = () => {
    if (isLast) {
      finish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const back = () => setIndex((i) => Math.max(0, i - 1));

  const cardStyle: CSSProperties = rect
    ? (() => {
        const cardWidth = 320;
        const margin = 16;
        const spaceBelow = window.innerHeight - rect.top - rect.height;
        const placeBelow = spaceBelow > 180 || rect.top < 180;
        const top = placeBelow ? rect.top + rect.height + 12 : Math.max(margin, rect.top - 12);
        const left = Math.min(
          Math.max(margin, rect.left + rect.width / 2 - cardWidth / 2),
          window.innerWidth - cardWidth - margin
        );
        return placeBelow
          ? { position: 'fixed', top, left, width: cardWidth }
          : { position: 'fixed', bottom: window.innerHeight - top, left, width: cardWidth };
      })()
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: 320,
        transform: 'translate(-50%, -50%)',
      };

  return (
    <div className="fixed inset-0 z-[9998]" style={{ pointerEvents: 'none' }}>
      {rect && (
        <div
          className="fixed rounded-lg transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(3, 2, 19, 0.6)',
            pointerEvents: 'none',
          }}
        />
      )}
      {!rect && (
        <div className="fixed inset-0" style={{ background: 'rgba(3, 2, 19, 0.6)', pointerEvents: 'none' }} />
      )}

      <div
        className="bg-white rounded-xl shadow-xl border p-5"
        style={{ ...cardStyle, pointerEvents: 'auto', zIndex: 9999 }}
      >
        <p className="text-xs font-medium text-muted-foreground mb-2">
          {t('onboarding.stepCounter', { current: index + 1, total: steps.length })}
        </p>
        <h3 className="text-base font-semibold mb-1.5">{t(step.titleKey)}</h3>
        <p className="text-sm text-gray-600 mb-4">{t(step.bodyKey)}</p>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="text-xs text-muted-foreground hover:text-gray-700"
          >
            {t('onboarding.skip')}
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={back}>
                {t('onboarding.back')}
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {isLast ? t('onboarding.finish') : t('onboarding.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
