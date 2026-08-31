import React from 'react';
import { Link } from '@tanstack/react-router';
import { ShieldCheck, MapPin, Phone, Mail, Clock } from 'lucide-react';

export const ApplyFooter: React.FC = () => {
  return (
    <footer className="no-print bg-white/80 dark:bg-[#0E131F]/90 backdrop-blur-2xl border-t border-black/[0.06] dark:border-white/[0.08] text-muted-foreground text-xs pt-12 pb-16 mt-16">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-black/[0.06] dark:border-white/[0.08]">
          
          {/* Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <img src="/SVG_MARK.svg" alt="Forge & Fabric Industries, Inc. Logo" className="h-7 w-auto object-contain" />
              <span className="font-bold text-sm text-foreground">
                FORGE &amp; FABRIC
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Industrial cut, make, and trim (CMT) garment manufacturing platform. Dual-facility operations across Petaluma and San Francisco Bay Area.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>ISO 9001 &amp; GOTS Certified Factory Floor</span>
            </div>
          </div>

          {/* Facility Locations */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Facility Locations
            </h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#0071E3] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">Distribution &amp; Laundry:</strong><br />
                  1280 Industrial Ave, Petaluma, CA 94952
                </span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#0071E3] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">Sewing &amp; Cutting Facility:</strong><br />
                  845 Marina Blvd, San Leandro, CA 94577
                </span>
              </li>
            </ul>
          </div>

          {/* Quick Intake Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Intake Portal
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/apply/new" className="text-muted-foreground hover:text-[#0071E3] font-medium transition-colors">
                  Submit Production Order (Bulk / Sample)
                </Link>
              </li>
              <li>
                <Link to="/apply/update" className="text-muted-foreground hover:text-[#0071E3] font-medium transition-colors">
                  Request Order / Cut Sheet Update
                </Link>
              </li>
              <li>
                <Link to="/apply" className="text-muted-foreground hover:text-[#0071E3] font-medium transition-colors">
                  Client Self-Service Guide
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-muted-foreground hover:text-[#0071E3] font-medium transition-colors">
                  Staff &amp; Merchandiser Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Direct Support & Operating Hours */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Production Floor Support
            </h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Mon–Fri: 6:00 AM – 5:30 PM PST</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Direct Line: (707) 555-0192</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span>intake@forgefabric.com</span>
              </p>
            </div>
          </div>

        </div>

        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Forge &amp; Fabric Industries, Inc. All rights reserved.</p>
          <div className="flex gap-6 font-medium">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Production</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/compliance" className="hover:text-foreground transition-colors">Quality &amp; Safety Compliance</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
