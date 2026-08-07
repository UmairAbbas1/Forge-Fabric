import { Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { 
  Globe, Search, BookOpen, Bookmark, ShoppingBag, User, Phone, Menu, X, 
  ChevronDown, Check, Download, ExternalLink, ArrowRight, ShieldCheck, 
  MapPin, Clock, Send, Sparkles, Layers, FileText
} from "lucide-react";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Interactive UI Modals & Drawers
  const [selectedHQ, setSelectedHQ] = useState("Global HQ (Dubai)");
  const [showHqModal, setShowHqModal] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const [showResourcesModal, setShowResourcesModal] = useState(false);
  const [showSavedListsModal, setShowSavedListsModal] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  
  // Mega-menu active tab
  const [activeMegaMenu, setActiveMegaMenu] = useState<string | null>(null);

  // Form State for Contact Modal
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSuccess, setContactSuccess] = useState(false);

  // Saved items list state
  const [savedItems, setSavedItems] = useState([
    { id: 1, name: "14oz Heavy Ring-Spun Indigo Denim", category: "Dyeable Fabric", moq: "500 Yds" },
    { id: 2, name: "380 GSM Organic French Terry Cotton", category: "Knitted Fabric", moq: "300 Yds" },
    { id: 3, name: "Ozone Bio-Wash Sustainable Finish", category: "Wash Finish", moq: "100 Units" },
  ]);

  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSuccess(true);
    setTimeout(() => {
      setContactSuccess(false);
      setShowContactModal(false);
      setContactName("");
      setContactEmail("");
      setContactMessage("");
    }, 2000);
  };

  const removeItem = (id: number) => {
    setSavedItems(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="bg-[#FAF8F5] text-neutral-900 font-sans overflow-x-hidden min-h-screen relative">
      
      {/* 1. Dark Top Bar */}
      <div className="bg-neutral-950 text-neutral-300 text-xs py-2.5 px-4 md:px-12 flex justify-between items-center border-b border-neutral-800 z-50 relative">
        <div className="flex items-center gap-4">
          
          {/* Location Selector Button */}
          <button 
            onClick={() => setShowHqModal(true)}
            className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 hover:border-sky-500 px-3 py-1 rounded-full text-neutral-200 transition-all cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-medium">{selectedHQ}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          
          {/* Live Search Bar */}
          <div ref={searchRef} className="relative hidden sm:block w-64 md:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(e.target.value.length > 0);
              }}
              onFocus={() => setShowSearchDropdown(searchQuery.length > 0)}
              placeholder="Search materials, POs, style numbers..."
              className="w-full bg-neutral-900/90 border border-neutral-800 rounded-full pl-8 pr-4 py-1 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-sky-500 transition-colors"
            />

            {/* Interactive Search Overlay */}
            {showSearchDropdown && (
              <div className="absolute left-0 top-full mt-2 w-full bg-white text-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 p-4 z-50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600 mb-2">Quick Search Results</div>
                <div className="space-y-2">
                  <button 
                    onClick={() => { navigate({ to: "/materials" }); setShowSearchDropdown(false); }}
                    className="w-full text-left p-2 rounded-lg hover:bg-sky-50 transition-colors flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-neutral-900">Indigo Denim Roll (14oz)</div>
                      <div className="text-[10px] text-neutral-500">Material Batch MAT-1002</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
                  </button>

                  <button 
                    onClick={() => { navigate({ to: "/orders" }); setShowSearchDropdown(false); }}
                    className="w-full text-left p-2 rounded-lg hover:bg-sky-50 transition-colors flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-neutral-900">Purchase Order PO-90210</div>
                      <div className="text-[10px] text-neutral-500">Customer: Levi Strauss &amp; Co.</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-5 text-neutral-400">
          <Link 
            to="/login" 
            className="flex items-center justify-center bg-neutral-900 border border-neutral-800 hover:border-sky-500 p-1.5 rounded-full text-neutral-200 transition-colors"
            title="User Account"
          >
            <User className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 2. Main White Navigation Header */}
      <nav
        className={`w-full bg-white border-b border-neutral-200/80 sticky top-0 z-40 transition-all duration-300 ${
          scrolled ? "shadow-md py-3" : "py-4"
        }`}
      >
        <div className="flex justify-between items-center px-4 lg:px-6 xl:px-12 max-w-7xl mx-auto gap-4">
          <div className="flex items-center gap-4 xl:gap-6 shrink-0">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 text-neutral-700 hover:text-black"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            <Link to="/" className="flex items-center gap-3 py-1 group shrink-0 select-none">
              <img src="/SVG_MARK.svg" alt="Forge & Fabric Logo" draggable={false} className="h-10 w-auto md:h-12 object-contain group-hover:scale-105 transition-transform pointer-events-none select-none" />
              <span className="font-display text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-neutral-950 whitespace-nowrap">
                FORGE<span className="text-blue-600 font-serif italic font-normal">&amp;</span>FABRIC
              </span>
            </Link>
          </div>

          {/* Desktop Mega Menu Navigation Links */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-8 text-xs font-bold uppercase tracking-wider text-neutral-800">
            
            <div 
              onMouseEnter={() => setActiveMegaMenu("dyeable")}
              onMouseLeave={() => setActiveMegaMenu(null)}
              className="relative py-2"
            >
              <div className="flex items-center gap-1 cursor-pointer hover:text-sky-600 transition-colors">
                <span>Dyeable</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </div>

              {activeMegaMenu === "dyeable" && (
                <div className="absolute top-full left-0 w-64 bg-white border border-neutral-200 rounded-2xl shadow-xl p-4 z-50 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Raw Dyeable Fabric</div>
                  <Link to="/materials" className="block text-xs font-semibold text-neutral-800 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors">
                    Organic Raw Cotton
                  </Link>
                  <Link to="/materials" className="block text-xs font-semibold text-neutral-800 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors">
                    PFD Prepared for Dyeing Denim
                  </Link>
                  <Link to="/materials" className="block text-xs font-semibold text-neutral-800 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors">
                    Heavy French Terry Rolls
                  </Link>
                </div>
              )}
            </div>

            <div 
              onMouseEnter={() => setActiveMegaMenu("dyed")}
              onMouseLeave={() => setActiveMegaMenu(null)}
              className="relative py-2"
            >
              <div className="flex items-center gap-1 cursor-pointer hover:text-sky-600 transition-colors">
                <span>Dyed &amp; Finished</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </div>

              {activeMegaMenu === "dyed" && (
                <div className="absolute top-full left-0 w-64 bg-white border border-neutral-200 rounded-2xl shadow-xl p-4 z-50 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Finished Textiles</div>
                  <Link to="/materials" className="block text-xs font-semibold text-neutral-800 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors">
                    Sulphur Black Dye
                  </Link>
                  <Link to="/materials" className="block text-xs font-semibold text-neutral-800 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors">
                    Indanthrene Fast Color
                  </Link>
                  <Link to="/materials" className="block text-xs font-semibold text-neutral-800 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors">
                    Ozone Bio Wash Finish
                  </Link>
                </div>
              )}
            </div>

            <div 
              onMouseEnter={() => setActiveMegaMenu("mto")}
              onMouseLeave={() => setActiveMegaMenu(null)}
              className="relative py-2"
            >
              <div className="flex items-center gap-1 cursor-pointer hover:text-sky-600 transition-colors">
                <span>Made to Order</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </div>

              {activeMegaMenu === "mto" && (
                <div className="absolute top-full left-0 w-64 bg-white border border-neutral-200 rounded-2xl shadow-xl p-4 z-50 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Custom CMT Garments</div>
                  <Link to="/orders" className="block text-xs font-semibold text-neutral-800 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors">
                    Custom Tech Pack Intake
                  </Link>
                  <Link to="/orders" className="block text-xs font-semibold text-neutral-800 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors">
                    Custom Denim Conversion
                  </Link>
                  <Link to="/orders" className="block text-xs font-semibold text-neutral-800 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors">
                    Heavy Outerwear CMT
                  </Link>
                </div>
              )}
            </div>

            <div 
              onMouseEnter={() => setActiveMegaMenu("tracking")}
              onMouseLeave={() => setActiveMegaMenu(null)}
              className="relative py-2"
            >
              <div className="flex items-center gap-1 cursor-pointer hover:text-sky-600 transition-colors">
                <span>13 Stage Tracking</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </div>

              {activeMegaMenu === "tracking" && (
                <div className="absolute top-full right-0 w-72 bg-white border border-neutral-200 rounded-2xl shadow-xl p-4 z-50 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Live Production Pipeline</div>
                  <Link to="/process" className="block text-xs font-semibold text-neutral-800 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors">
                    Stages 1 to 5: Intake &amp; Cutting
                  </Link>
                  <Link to="/process" className="block text-xs font-semibold text-neutral-800 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors">
                    Stages 6 to 9: Sewing &amp; Washing
                  </Link>
                  <Link to="/process" className="block text-xs font-semibold text-neutral-800 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors">
                    Stages 10 to 13: AQL Audit &amp; Dispatch
                  </Link>
                </div>
              )}
            </div>

          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowContactModal(true)}
              className="hidden sm:flex items-center gap-2 bg-neutral-950 text-white hover:bg-sky-500 px-4 xl:px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              <span>Contact</span>
              <Phone className="w-3.5 h-3.5" />
            </button>
            
            <Link
              to="/dashboard"
              className="bg-sky-500 hover:bg-sky-600 text-white px-4 xl:px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-sm whitespace-nowrap"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-neutral-100 p-6 space-y-4 shadow-xl">
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-center bg-neutral-950 text-white py-3 rounded-full text-sm font-bold uppercase tracking-wider"
            >
              Client Portal Dashboard
            </Link>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-neutral-950 text-neutral-400 py-12 px-6 md:px-12 border-t border-neutral-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-xs">
          <div className="flex items-center gap-3">
            <img
              src="/SVG_MARK.svg"
              alt="Forge & Fabric Logo"
              draggable={false}
              data-no-lens="true"
              data-lens-widget="false"
              data-no-search="true"
              className="h-8 w-auto object-contain pointer-events-none select-none"
            />
            <span className="text-white font-bold text-sm tracking-wide">FORGE &amp; FABRIC</span>
          </div>
          <p>© {new Date().getFullYear()} Forge &amp; Fabric Industrial Garment Conversion. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <button onClick={() => setShowContactModal(true)} className="hover:text-white transition-colors cursor-pointer">
              Contact Support
            </button>
          </div>
        </div>
      </footer>

      {/* MODAL 1: Global HQ Location Selector Modal */}
      {showHqModal && (
        <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm z-50 grid place-items-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-6">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-lg text-neutral-950">Select Regional HQ</h3>
              </div>
              <button onClick={() => setShowHqModal(false)} className="text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { name: "Global HQ (Dubai)", desc: "Main Sourcing Hub &amp; Executive Office" },
                { name: "North America (New York)", desc: "Brand Relations &amp; Design Review" },
                { name: "European Hub (London)", desc: "Textile Compliance &amp; AQL Center" },
                { name: "Asian Factory (Lahore)", desc: "13 Stage Garment Conversion Plant" },
                { name: "Eurasia Hub (Istanbul)", desc: "Denim Washing &amp; Ozone Finishing" },
              ].map((hq) => (
                <button
                  key={hq.name}
                  onClick={() => {
                    setSelectedHQ(hq.name);
                    setShowHqModal(false);
                  }}
                  className={`w-full p-3 rounded-2xl text-left border transition-all flex items-center justify-between ${
                    selectedHQ === hq.name
                      ? "border-sky-500 bg-sky-50/60 font-bold"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-neutral-950">{hq.name}</div>
                    <div className="text-[10px] text-neutral-500">{hq.desc}</div>
                  </div>
                  {selectedHQ === hq.name && <Check className="w-4 h-4 text-sky-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Resources & Documentation Modal */}
      {showResourcesModal && (
        <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm z-50 grid place-items-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-6">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-lg text-neutral-950">Technical Resources</h3>
              </div>
              <button onClick={() => setShowResourcesModal(false)} className="text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { title: "Garment CMT Conversion Standard Guidelines", size: "2.4 MB PDF" },
                { title: "AQL 2.5 Quality Control Inspection Protocol", size: "1.8 MB PDF" },
                { title: "Ozone Washing & Bio Wash Eco Specifications", size: "3.1 MB PDF" },
                { title: "Customer Supplied Fabric Testing Manual", size: "1.2 MB PDF" },
              ].map((doc, idx) => (
                <div key={idx} className="p-3 border border-neutral-200 rounded-2xl flex items-center justify-between hover:bg-neutral-50 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-neutral-950">{doc.title}</div>
                    <div className="text-[10px] text-neutral-500">{doc.size}</div>
                  </div>
                  <button 
                    onClick={() => alert(`Downloading ${doc.title}`)}
                    className="p-2 bg-sky-50 hover:bg-sky-500 text-sky-700 hover:text-white rounded-xl transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Saved Items / Wishlist Modal */}
      {showSavedListsModal && (
        <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm z-50 grid place-items-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-6">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-lg text-neutral-950">Saved Material Specs</h3>
              </div>
              <button onClick={() => setShowSavedListsModal(false)} className="text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {savedItems.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">No saved material specifications.</p>
            ) : (
              <div className="space-y-3">
                {savedItems.map((item) => (
                  <div key={item.id} className="p-3 border border-neutral-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-neutral-950">{item.name}</div>
                      <div className="text-[10px] text-sky-600 font-semibold">{item.category} • MOQ {item.moq}</div>
                    </div>
                    <button 
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors"
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: Cart / Orders Quick Drawer */}
      {showCartDrawer && (
        <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm z-50 grid place-items-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-6">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-lg text-neutral-950">Active Orders Overview</h3>
              </div>
              <button onClick={() => setShowCartDrawer(false)} className="text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl">
                <div className="text-xs font-bold text-neutral-950">Order PO 90210 (Levi Strauss &amp; Co.)</div>
                <div className="text-[10px] text-sky-700 mt-1">Status: Stage 8 Sewing Assembly • 1,200 Units</div>
              </div>
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl">
                <div className="text-xs font-bold text-neutral-950">Order PO 90214 (Everlane Outerwear)</div>
                <div className="text-[10px] text-neutral-600 mt-1">Status: Stage 3 Cutting Clearance • 800 Units</div>
              </div>
            </div>

            <button 
              onClick={() => { setShowCartDrawer(false); navigate({ to: "/orders" }); }}
              className="w-full bg-neutral-950 text-white hover:bg-sky-500 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Open Full Order Dashboard
            </button>
          </div>
        </div>
      )}

      {/* MODAL 5: Interactive Contact & Tour Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm z-50 grid place-items-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-6">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-lg text-neutral-950">Contact Forge &amp; Fabric</h3>
              </div>
              <button onClick={() => setShowContactModal(false)} className="text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {contactSuccess ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                <Check className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="font-bold text-neutral-950 text-base">Inquiry Submitted Successfully</div>
                <p className="text-xs text-neutral-600">Our industrial sourcing team will contact you within 2 business hours.</p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">Your Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={contactName} 
                    onChange={e => setContactName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">Company Email</label>
                  <input 
                    type="email" 
                    required
                    value={contactEmail} 
                    onChange={e => setContactEmail(e.target.value)}
                    placeholder="s.jenkins@brand.com"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">Inquiry / Tour Schedule Details</label>
                  <textarea 
                    rows={3}
                    required
                    value={contactMessage} 
                    onChange={e => setContactMessage(e.target.value)}
                    placeholder="Tell us about your fabric conversion requirements and order quantities..."
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-sky-500 hover:bg-neutral-950 text-white py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <span>Submit Inquiry</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
