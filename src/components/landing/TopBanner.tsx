const TopBanner = () => {
  return (
    <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-b border-border/50">
      <div className="container-custom py-2.5 flex items-center justify-center gap-2">
        <span className="badge-pill text-xs">
          <i className='bx bx-rocket'></i>
          Agora em Beta Público
        </span>
      </div>
    </div>
  );
};

export default TopBanner;
