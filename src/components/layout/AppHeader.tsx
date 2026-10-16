import { useState } from "react";
import { Plane, Info, X } from "lucide-react";

export default function AppHeader() {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <header className="bg-card border-b border-border pt-2 pb-2 sm:pt-5 sm:pb-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-14 sm:h-14 rounded bg-primary flex items-center justify-center text-primary-foreground shadow-lg flex-shrink-0">
              <Plane className="w-5 h-5 sm:w-8 sm:h-8" />
            </div>
            <div className="flex-1">
              <h1 className="font-bold font-heading tracking-tight leading-tight text-foreground text-[28px] sm:text-4xl md:text-5xl">
                AeroMate
              </h1>
            </div>
            <button
              onClick={() => setShowInfo(true)}
              data-testid="button-info"
              aria-label="App information"
              className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-secondary transition-colors flex-shrink-0"
            >
              <Info className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </header>

      {showInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="App information"
        >
          <div
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setShowInfo(false)}
          />
          <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-sm p-6 space-y-5">
            <button
              onClick={() => setShowInfo(false)}
              data-testid="button-info-close"
              aria-label="Close"
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={18} />
            </button>

            <h2 className="font-heading font-bold text-2xl text-foreground leading-tight pr-8">
              AeroMate
            </h2>

            <div className="space-y-3 text-base">
              <InfoRow label="Version" value="v1.0.4" />
              <div className="border-t border-border" />
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Developed by
                </p>
                <p className="text-foreground font-medium">GMPML</p>
                <p className="text-foreground font-medium">Kwang-Yeol Jeong</p>
              </div>
              <div className="border-t border-border" />

              <InfoRow label="Last Updated" value="2026.10" />

              <div className="border-t border-border" />

              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Update History
                </p>

                <p className="text-foreground font-medium mb-1">
  2026.10
</p>

<div className="space-y-1 text-foreground font-medium">
  <p>• Removed Calendar Icon & Optimized Mobile Date Display</p>
</div>

<p className="text-foreground font-medium mb-1 mt-4">
  2026.08
</p>

<div className="space-y-1 text-foreground font-medium">
  <p>• Added Time Calculator</p>
  <p>• Added UTC Clock</p>
  <p>• Improved UI Layout</p>
</div>
              </div>
            </div>

            <button
              onClick={() => setShowInfo(false)}
              data-testid="button-info-close-bottom"
              className="w-full h-12 rounded-md border-2 border-primary bg-primary text-primary-foreground font-semibold font-heading text-base hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-foreground font-medium">{value}</p>
    </div>
  );
}
