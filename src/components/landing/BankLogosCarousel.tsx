'use client';

import Image from 'next/image';

// Bank connector icons available in /public/assets/connector-icons/
const bankIcons = [
  '202', '203', '205', '206', '207', '208', '209',
  '210', '211', '212', '213', '214', '216', '217', '218', '219',
  '220', '221', '222', '223', '224', '226', '227', '228', '229',
  '230', '231', '234', '235', '236', '237', '238', '239',
  '241', '243',
];

const BankLogosCarousel = () => {
  // Logos that should keep their original colors
  const coloredLogos = ['206', '218'];

  // Split icons into three rows for better distribution
  const countPerRow = Math.ceil(bankIcons.length / 3);
  const row1 = bankIcons.slice(0, countPerRow);
  const row2 = bankIcons.slice(countPerRow, countPerRow * 2);
  const row3 = bankIcons.slice(countPerRow * 2);

  // Duplicate the arrays for seamless infinite scroll
  const duplicatedIconsRow1 = [...row1, ...row1];
  const duplicatedIconsRow2 = [...row2, ...row2];
  const duplicatedIconsRow3 = [...row3, ...row3];

  const renderLogo = (icon: string, index: number, rowTag: string) => {
    const isColored = coloredLogos.includes(icon);
    return (
      <div
        key={`logo-${rowTag}-${icon}-${index}`}
        className="flex-shrink-0 flex items-center justify-center hover:scale-110 transition-transform duration-300 opacity-70 hover:opacity-100"
      >
        <Image
          src={`/assets/connector-icons/${icon}.svg`}
          alt={`Banco ${icon}`}
          width={80}
          height={80}
          className={`w-16 h-16 md:w-20 md:h-20 object-contain transition-all duration-300 ${!isColored ? 'brightness-0 dark:invert' : ''
            }`}
        />
      </div>
    );
  };

  return (
    <section id="banks" className="pt-6 md:pt-8 pb-12 md:pb-16 bg-muted/20 overflow-hidden">
      <div className="container-custom mb-12 md:mb-16">
        <div className="text-center">
          <span className="badge-pill mb-4">
            <i className='bx bx-bank'></i>
            Open Finance
          </span>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">
            +40 Bancos <span className="gradient-text">Compatíveis</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            Conecte-se aos principais bancos brasileiros através do Open Finance
          </p>
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative group space-y-4 md:space-y-6">
        {/* Gradient Overlays for fade effect */}
        <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-r from-muted/20 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-l from-muted/20 to-transparent z-10 pointer-events-none" />

        {/* Row 1 - scrolling left */}
        <div className="flex items-center gap-10 md:gap-14 animate-scroll-left group-hover:[animation-play-state:paused] w-max">
          {duplicatedIconsRow1.map((icon, index) => renderLogo(icon, index, 'r1'))}
        </div>

        {/* Row 2 - scrolling right */}
        <div className="flex items-center gap-10 md:gap-14 animate-scroll-right group-hover:[animation-play-state:paused] w-max">
          {duplicatedIconsRow2.map((icon, index) => renderLogo(icon, index, 'r2'))}
        </div>

        {/* Row 3 - scrolling left */}
        <div className="flex items-center gap-10 md:gap-14 animate-scroll-left group-hover:[animation-play-state:paused] w-max">
          {duplicatedIconsRow3.map((icon, index) => renderLogo(icon, index, 'r3'))}
        </div>
      </div>
    </section>
  );
};

export default BankLogosCarousel;
