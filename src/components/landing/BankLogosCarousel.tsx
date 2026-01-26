import Image from 'next/image';

// Bank connector icons available in /public/assets/connector-icons/
const bankIcons = [
  '1', '201', '202', '203', '205', '206', '207', '208', '209',
  '210', '211', '212', '213', '214', '215', '216', '217', '218', '219',
  '220', '221', '222', '223', '224', '225', '226', '227', '228', '229',
  '230', '231', '232', '233', '234', '235', '236', '237', '238', '239',
  '240', '241', '242', '243',
];

const BankLogosCarousel = () => {
  // Duplicate the array for seamless infinite scroll
  const duplicatedIcons = [...bankIcons, ...bankIcons];

  return (
    <section id="banks" className="pt-6 md:pt-8 pb-12 md:pb-16 bg-muted/20 overflow-hidden">
      <div className="container-custom mb-12 md:mb-16">
        <div className="text-center">
          <span className="badge-pill mb-4">
            <i className='bx bx-bank'></i>
            Open Finance
          </span>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">
            Bancos <span className="gradient-text">Compatíveis</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            Conecte-se aos principais bancos brasileiros através do Open Finance
          </p>
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative group">
        {/* Gradient Overlays for fade effect */}
        <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-r from-muted/20 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-l from-muted/20 to-transparent z-10 pointer-events-none" />

        {/* Single Row - scrolling left */}
        <div className="flex items-center gap-10 md:gap-14 animate-scroll-left group-hover:[animation-play-state:paused]">
          {duplicatedIcons.map((icon, index) => (
            <div
              key={`logo-${icon}-${index}`}
              className="flex-shrink-0 flex items-center justify-center hover:scale-110 transition-transform duration-300 opacity-70 hover:opacity-100"
            >
              <Image
                src={`/assets/connector-icons/${icon}.svg`}
                alt={`Banco ${icon}`}
                width={96}
                height={96}
                className="w-20 h-20 md:w-24 md:h-24 object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BankLogosCarousel;
