import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, Link as LinkIcon, MoreHorizontal, Check } from 'lucide-react';

interface PhotoViewerProps {
  src: string;
  alt?: string;
  /** If true, the Save image option is hidden */
  isPrivate?: boolean;
  onClose: () => void;
}

export function PhotoViewer({ src, alt = 'Photo', isPrivate = false, onClose }: PhotoViewerProps) {
  const [scale, setScale] = useState(1);
  const [translateY, setTranslateY] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const touchStartY = useRef(0);
  const pinchStartDist = useRef(0);
  const isDragging = useRef(false);
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent background scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function getPinchDist(touches: React.TouchList) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      touchStartY.current = e.touches[0].clientY;
      isDragging.current = true;
    } else if (e.touches.length === 2) {
      pinchStartDist.current = getPinchDist(e.touches);
      isDragging.current = false;
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging.current && scaleRef.current <= 1.05) {
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0) setTranslateY(dy);
    } else if (e.touches.length === 2) {
      const dist = getPinchDist(e.touches);
      const ratio = dist / (pinchStartDist.current || 1);
      setScale(prev => Math.min(Math.max(prev * ratio, 1), 5));
      pinchStartDist.current = dist;
    }
  }

  function handleTouchEnd() {
    if (translateY > 80) {
      onClose();
    } else {
      setTranslateY(0);
    }
    isDragging.current = false;
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(src); } catch { /* ok */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareImage() {
    if (navigator.share) {
      await navigator.share({ url: src, title: 'Photo from Noelaven' }).catch(() => {});
    } else {
      copyLink();
    }
  }

  const bgOpacity = Math.max(0, 1 - translateY / 200);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: bgOpacity }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
      onClick={() => setShowMenu(false)}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-12 pb-4">
        <button
          onClick={e => { e.stopPropagation(); onClose(); }}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
        >
          <X size={20} className="text-white" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
        >
          <MoreHorizontal size={20} className="text-white" />
        </button>
      </div>

      {/* Image — swipe-to-dismiss + pinch-to-zoom */}
      <div
        className="w-full h-full flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            transition: 'transform 0.1s',
          }}
        />
      </div>

      {/* Action menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            onClick={e => e.stopPropagation()}
            className="absolute bottom-8 left-4 right-4 bg-[#111] rounded-[24px] shadow-2xl overflow-hidden"
          >
            {!isPrivate && (
              <a
                href={src}
                download="noelaven-photo.jpg"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-5 py-4 active:bg-[#111]"
                onClick={() => setShowMenu(false)}
              >
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Download size={17} className="text-[#F5C542]" />
                </div>
                <span className="text-[15px] font-medium text-white">Save image</span>
              </a>
            )}
            <button
              onClick={() => { shareImage(); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-5 py-4 active:bg-[#111] border-t border-[#222]"
            >
              <div className="w-9 h-9 rounded-full bg-[rgba(245,197,66,0.08)] flex items-center justify-center flex-shrink-0">
                <Share2 size={17} className="text-[#F5C542]" />
              </div>
              <span className="text-[15px] font-medium text-white">Share</span>
            </button>
            <button
              onClick={copyLink}
              className="w-full flex items-center gap-3 px-5 py-4 active:bg-[#111] border-t border-[#222]"
            >
              <div className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                {copied
                  ? <Check size={17} className="text-green-500" />
                  : <LinkIcon size={17} className="text-[#BDBDBD]" />
                }
              </div>
              <span className="text-[15px] font-medium text-white">
                {copied ? 'Link copied!' : 'Copy image link'}
              </span>
            </button>
            <button
              onClick={() => setShowMenu(false)}
              className="w-full flex items-center justify-center px-5 py-4 bg-[#111] border-t border-[#222]"
            >
              <span className="text-[15px] font-semibold text-[#BDBDBD]">Cancel</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
