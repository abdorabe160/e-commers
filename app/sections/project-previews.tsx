export function ElectronicsStorePreview() {
  return (
    <div className="absolute inset-0">
      <img
        src="/electronics-theme.webp"
        alt=""
        aria-hidden="true"
        className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
    </div>
  );
}

export function SportswearPreview() {
  return (
    <div className="absolute inset-0">
      <img
        src="/sportswear-theme.webp"
        alt=""
        aria-hidden="true"
        className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
    </div>
  );
}

export function MishMavinPreview() {
  return (
    <div className="absolute inset-0">
      <img
        src="/mish-mavin-theme.webp"
        alt=""
        aria-hidden="true"
        className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
    </div>
  );
}
