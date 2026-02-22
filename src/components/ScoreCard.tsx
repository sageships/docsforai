'use client';

import { useEffect, useState } from 'react';

import { SCORE_COLORS } from '@/lib/constants';

interface ScoreCardProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function ScoreCard({ score, size = 'lg' }: ScoreCardProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [progress, setProgress] = useState(0);

  const dimensions = {
    sm: { radius: 40, stroke: 6, svgSize: 100, fontSize: 'text-2xl' },
    md: { radius: 60, stroke: 8, svgSize: 140, fontSize: 'text-4xl' },
    lg: { radius: 80, stroke: 10, svgSize: 180, fontSize: 'text-6xl' },
  };

  const { radius, stroke, svgSize, fontSize } = dimensions[size];
  const circumference = 2 * Math.PI * radius;
  const color = SCORE_COLORS.hex(score);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += 1;
      const eased = 1 - Math.pow(1 - current / steps, 3);
      setAnimatedScore(Math.round(score * eased));
      setProgress(score * eased);

      if (current >= steps) {
        clearInterval(timer);
        setAnimatedScore(score);
        setProgress(score);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [score]);

  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="-rotate-90"
        >
          {/* Background ring */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="#1f2937"
            strokeWidth={stroke}
          />
          {/* Progress ring */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.05s linear, stroke 0.3s ease' }}
          />
        </svg>

        {/* Score number in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${fontSize} font-bold leading-none`} style={{ color }}>
            {animatedScore}
          </span>
          {size === 'lg' && <span className="text-xs text-gray-400 mt-1 font-medium">/ 100</span>}
        </div>
      </div>

      <div className="text-center">
        <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">
          AI-Readiness Score
        </p>
        <p className="text-sm font-semibold mt-0.5" style={{ color }}>
          {SCORE_COLORS.label(score)}
        </p>
      </div>
    </div>
  );
}
