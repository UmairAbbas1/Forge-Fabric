import React from 'react';
import { Link } from '@tanstack/react-router';
import { ShieldCheck, MapPin, Phone, Mail, Clock } from 'lucide-react';

export const ApplyFooter: React.FC = () => {
  return (
    <footer className="bg-neutral-950 text-neutral-400 text-sm pt-12 pb-16 mt-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-neutral-800">
          
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <img src="/SVG_MARK.svg" alt="Forge & Fabric Industries, Inc. Logo" className="h-9 w-auto object-contain" />
              <span className="font-display text-xl font-bold text-white">
                Forge &amp; Fabric
              </span>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Industrial cut, make, and trim (CMT) garment manufacturing platform. Dual-facility operations across Petaluma and San Francisco Bay Area.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>ISO 9001 &amp; GOTS Certified Production Floor</span>
            </div>
          </div>

          {/* Facility Locations */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Facility Locations
            </h4>
            <ul className="space-y-2.5 text-xs text-neutral-500">
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-300">Distribution &amp; Laundry:</strong><br />
                  1280 Industrial Ave, Petaluma, CA 94952
                </span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-300">Sewing &amp; Cutting Facility:</strong><br />
                  845 Marina Blvd, San Leandro, CA 94577
                </span>
              </li>
            </ul>
          </div>

          {/* Quick Intake Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Intake Portal
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/apply/new" className="text-neutral-500 hover:text-white font-medium transition-colors">
                  Submit Production Order (Bulk / Sample)
                </Link>
              </li>
              <li>
                <Link to="/apply/update" className="text-neutral-500 hover:text-white font-medium transition-colors">
                  Request Order / Cut Sheet Update
                </Link>
              </li>
              <li>
                <Link to="/apply" className="text-neutral-500 hover:text-white font-medium transition-colors">
                  Client Self-Service Guide
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-neutral-500 hover:text-white font-medium transition-colors">
                  Staff &amp; Merchandiser Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Direct Support & Operating Hours */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Production Floor Support
            </h4>
            <div className="space-y-2 text-xs text-neutral-500">
              <p className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-neutral-600" />
                <span>Mon–Fri: 6:00 AM – 5:30 PM PST</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-neutral-600" />
                <span>Direct Line: (707) 555-0192</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-neutral-600" />
                <span>intake@forgefabric.com</span>
              </p>
            </div>
          </div>

        </div>

        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-neutral-600">
          <p>© {new Date().getFullYear()} Forge &amp; Fabric LLC. All rights reserved.</p>
          <div className="flex gap-6 font-medium">
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Production</Link>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/compliance" className="hover:text-white transition-colors">Quality &amp; Safety Compliance</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
