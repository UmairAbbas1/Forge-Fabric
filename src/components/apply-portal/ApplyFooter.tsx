import React from 'react';
import { Link } from '@tanstack/react-router';
import { ShieldCheck, MapPin, Phone, Mail, Clock } from 'lucide-react';

export const ApplyFooter: React.FC = () => {
  return (
    <footer className="bg-white text-neutral-600 text-sm border-t border-neutral-200 pt-12 pb-16 mt-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-neutral-200">
          
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center p-1 shadow-xs">
                <img src="/SVG_MARK.svg" alt="Forge & Fabric Logo" className="h-full w-auto object-contain" />
              </div>
              <span className="font-display text-xl font-bold text-neutral-900">
                Forge &amp; Fabric
              </span>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Industrial cut, make, and trim (CMT) garment manufacturing platform. Dual-facility operations across Petaluma and San Francisco Bay Area.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ISO 9001 &amp; GOTS Certified Production Floor</span>
            </div>
          </div>

          {/* Facility Locations */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
              Facility Locations
            </h4>
            <ul className="space-y-2.5 text-xs text-neutral-600">
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-800">Distribution &amp; Laundry:</strong><br />
                  1280 Industrial Ave, Petaluma, CA 94952
                </span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-800">Sewing &amp; Cutting Facility:</strong><br />
                  845 Marina Blvd, San Leandro, CA 94577
                </span>
              </li>
            </ul>
          </div>

          {/* Quick Intake Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
              Intake Portal
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/apply/new" className="text-neutral-600 hover:text-amber-800 font-medium transition-colors">
                  Submit Production Order (Bulk / Sample)
                </Link>
              </li>
              <li>
                <Link to="/apply/update" className="text-neutral-600 hover:text-amber-800 font-medium transition-colors">
                  Request Order / Cut Sheet Update
                </Link>
              </li>
              <li>
                <Link to="/apply" className="text-neutral-600 hover:text-amber-800 font-medium transition-colors">
                  Client Self-Service Guide
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-neutral-600 hover:text-amber-800 font-medium transition-colors">
                  Staff &amp; Merchandiser Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Direct Support & Operating Hours */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
              Production Floor Support
            </h4>
            <div className="space-y-2 text-xs text-neutral-600">
              <p className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span>Mon–Fri: 6:00 AM – 5:30 PM PST</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-neutral-400" />
                <span>Direct Line: (707) 555-0192</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-neutral-400" />
                <span>intake@forgefabric.com</span>
              </p>
            </div>
          </div>

        </div>

        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-neutral-500">
          <p>© {new Date().getFullYear()} Forge &amp; Fabric LLC. All rights reserved.</p>
          <div className="flex gap-6 font-medium">
            <Link to="/terms" className="hover:text-neutral-800">Terms of Production</Link>
            <Link to="/privacy" className="hover:text-neutral-800">Privacy Policy</Link>
            <Link to="/compliance" className="hover:text-neutral-800">Quality &amp; Safety Compliance</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
