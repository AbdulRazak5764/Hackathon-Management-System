import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Award, 
  ShieldCheck, 
  UserCheck, 
  FileText, 
  ArrowRight, 
  Lock, 
  Users, 
  Calendar, 
  MapPin, 
  User, 
  X,
  Sparkles
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [showPosterModal, setShowPosterModal] = useState(false);

  // Gallery Slideshow Data (Event Poster + 8 Live Photos)
  const galleryImages = [
    {
      src: '/sih_banner_landscape.jpg',
      title: 'Official Event Circular Poster — SIH 2026',
      description: 'Chaitanya (Deemed to be University) Internal Hackathon Official Announcement',
    },
    {
      src: '/gallery/event_photo_1.jpg',
      title: 'Hackathon Mentorship & Student Evaluation',
      description: 'Faculty members and SPOC evaluating student team solutions and technical prototypes',
    },
    {
      src: '/gallery/event_photo_2.jpg',
      title: 'Problem Statement Technical Guidance',
      description: 'Interactive discussion with CSE department mentors on problem statement approach',
    },
    {
      src: '/gallery/event_photo_3.jpg',
      title: 'Student Team Presentation & Code Demo',
      description: 'Registered student teams demonstrating project code and architecture',
    },
    {
      src: '/gallery/event_photo_4.jpg',
      title: 'Judging & Team Verification Session',
      description: '6-member team verification and slide format inspection session',
    },
    {
      src: '/gallery/event_photo_5.jpg',
      title: 'Internal Hackathon Lab Session',
      description: 'Live hackathon coordination lab at Chaitanya University Campus, Hyderabad',
    },
    {
      src: '/gallery/event_photo_6.jpg',
      title: 'Student Team Coding & Development Lab',
      description: 'Active coding and software building session in computer engineering lab',
    },
    {
      src: '/gallery/event_photo_7.jpg',
      title: 'Seminar Hall Orientation & Guidelines Briefing',
      description: 'SPOC Admin Dr R Praveen Kumar briefing registered student teams in seminar hall',
    },
    {
      src: '/gallery/event_photo_8.jpg',
      title: 'Female Team Member Brainstorming & Review',
      description: 'Female student developers collaborating on problem statement design & presentation',
    },
    {
      src: '/gallery/event_photo_9.jpg',
      title: 'Student Audience & Interactive Hackathon Briefing',
      description: 'Student participants listening attentively to SPOC guidelines in seminar hall',
    },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);

  // Non-stop automatic 2-second slideshow timer (2000ms)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % galleryImages.length);
    }, 2000);

    return () => clearInterval(timer);
  }, [galleryImages.length]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      {/* Event Header Banner */}
      <div className="text-center space-y-6 max-w-4xl mx-auto pt-2">
        {/* University Highlight Badge */}
        <div className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-blue-500/20 border border-amber-400/60 text-amber-300 text-xs sm:text-sm font-extrabold uppercase tracking-widest shadow-xl shadow-amber-500/10 hover:border-amber-400 transition-all">
          <Award className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-cyan-300">
            CHAITANYA (DEEMED TO BE UNIVERSITY)
          </span>
        </div>

        {/* Main Title */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-400">
            Hackathon Management System
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
          "Where knowledge grows, success follows, and freedom blossoms"
        </p>

        {/* Quick Details Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-xs">
          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl flex items-center space-x-3 text-slate-200 shadow-md">
            <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Event Date</span>
              <span className="font-bold text-white">Sept 1 & 2, 2026</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl flex items-center space-x-3 text-slate-200 shadow-md">
            <div className="p-2 rounded-xl bg-amber-950 text-amber-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Venue</span>
              <span className="font-bold text-white">Chaitanya University, HYD</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl flex items-center space-x-3 text-slate-200 shadow-md">
            <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400">
              <User className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">SPOC</span>
              <span className="font-bold text-white">Dr R Praveen Kumar</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            to="/student/login"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 flex items-center justify-center space-x-2 transition-all hover:scale-105"
          >
            <UserCheck className="w-5 h-5" />
            <span>Student Team Portal</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            to="/admin/login"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/40 hover:border-amber-400 font-bold text-sm shadow-xl flex items-center justify-center space-x-2 transition-all hover:scale-105"
          >
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span>College SPOC Admin Portal</span>
          </Link>
        </div>
      </div>

      {/* SEAMLESS 100% FILL HERO IMAGE SLIDESHOW (No Outer Box, No Left/Right Black Gaps) */}
      <div className="relative max-w-5xl mx-auto">
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-amber-500 to-blue-600 rounded-3xl blur-xl opacity-40 animate-pulse pointer-events-none"></div>

        <div 
          className="relative w-full h-[450px] sm:h-[650px] lg:h-[720px] rounded-3xl overflow-hidden shadow-2xl border border-slate-800/80 cursor-pointer group bg-slate-950 flex items-center justify-center"
          onClick={() => setShowPosterModal(true)}
        >
          {/* 100% Full Height Uncropped Image */}
          <img
            src={galleryImages[currentSlide].src}
            alt={galleryImages[currentSlide].title}
            className="w-full h-full object-contain transition-all duration-700 ease-in-out group-hover:scale-[1.01]"
            onError={(e: any) => {
              e.target.src = '/sih_banner.jpg';
            }}
          />

          {/* Overlay Caption & Indicator Dots */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent pt-10 pb-4 px-6 flex items-center justify-between gap-4">
            <div className="text-left">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{galleryImages[currentSlide].title}</span>
              </h3>
            </div>

            {/* Indicator Dots */}
            <div className="flex items-center space-x-1.5">
              {galleryImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSlide(idx);
                  }}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentSlide
                      ? 'w-7 bg-cyan-400 shadow-lg shadow-cyan-400/50'
                      : 'w-2 bg-slate-600/80 hover:bg-slate-400'
                  }`}
                  title={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-cyan-950 text-cyan-400 flex items-center justify-center mb-2 font-bold">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Strict 6-Member Validation</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Atomic DB-level enforcement ensuring exactly 6 members per team, mandatory female team member inclusion, and unique roll/email checks.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950 text-emerald-400 flex items-center justify-center mb-2 font-bold">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">SIH 6-Slide Template Inspector</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Automated structure analyzer verifying maximum 6 slides, mandatory section headings (Title Page, Technical Approach, Feasibility, Impact, etc.).
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-amber-950 text-amber-400 flex items-center justify-center mb-2 font-bold">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Private Storage & SPOC Review</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Uploaded presentations are saved in private cloud storage. SPOC Admin reviews submissions with live status updates and PDF report exports.
          </p>
        </div>
      </div>

      {/* Full Screen Lightbox Modal for Gallery Slide */}
      {showPosterModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-5xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-4">
            <button
              onClick={() => setShowPosterModal(false)}
              className="absolute top-6 right-6 z-20 p-2 rounded-full bg-slate-950/80 text-slate-300 hover:text-white border border-slate-700 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center justify-center p-2">
              <img
                src={galleryImages[currentSlide].src}
                alt={galleryImages[currentSlide].title}
                className="w-full h-auto max-h-[85vh] object-contain rounded-2xl"
                onError={(e: any) => {
                  e.target.src = '/sih_banner.jpg';
                }}
              />
              <div className="mt-3 text-center space-y-1">
                <h3 className="text-base font-bold text-white">{galleryImages[currentSlide].title}</h3>
                <p className="text-xs text-slate-400">{galleryImages[currentSlide].description}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
