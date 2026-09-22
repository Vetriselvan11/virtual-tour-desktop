import React from 'react';
import {
  LayoutDashboard, Map, Settings, LogOut, Plus, Pencil, Trash2, Copy, Share2,
  Image, MapPin, Link2, Info, Move, CircleDot, Circle, Eye, Maximize, Volume2,
  VolumeX, RotateCw, Search, Filter, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  X, Check, AlertTriangle, User, Lock, Compass, ArrowLeft, Globe, Upload, ZoomIn, ZoomOut, Target,
  RefreshCw, Play, FileText, Download, ArrowRight, Video, Zap, CheckCircle,
  FolderOpen, Folder, Camera, ClipboardPaste, MoreHorizontal, SkipBack,
  SkipForward, Pause, Save, Undo2, Redo2, Crosshair, PaintBucket, PlusCircle,
  Unlock, EyeOff, Minus, Crown, Sparkles, Layers, Sliders, Palette, Music,
  Mic, MessageSquare, Repeat, Clapperboard, Bolt, Film, RotateCcw, Activity,
  Square, Package, Maximize2, Minimize2, ArrowUp, ArrowDown, LogIn, ExternalLink,
  Star, Volume1, Volume, MousePointer, HelpCircle, Layers3, Flame, RefreshCcw,
  Grid, SlidersHorizontal, Box, Cuboid
} from 'lucide-react';
import * as FaIcons from 'react-icons/fa6';

const registry = {
  // Lucide Icons
  LayoutDashboard, Map, Settings, LogOut, Plus, Pencil, Trash2, Copy, Share2,
  Image, MapPin, Link2, Info, Move, CircleDot, Circle, Eye, Maximize, Volume2,
  VolumeX, RotateCw, Search, Filter, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  X, Check, AlertTriangle, User, Lock, Compass, ArrowLeft, Globe, Upload, ZoomIn, ZoomOut, Target,
  RefreshCw, Play, FileText, Download, ArrowRight, Video, Zap, CheckCircle,
  FolderOpen, Folder, Camera, ClipboardPaste, MoreHorizontal, SkipBack,
  SkipForward, Pause, Save, Undo2, Redo2, Crosshair, PaintBucket, PlusCircle,
  Unlock, EyeOff, Minus, Crown, Sparkles, Layers, Sliders, Palette, Music,
  Mic, MessageSquare, Repeat, Clapperboard, Bolt, Film, RotateCcw, Activity,
  Square, Package, Maximize2, Minimize2, ArrowUp, ArrowDown, LogIn, ExternalLink,
  Star, Volume1, Volume, MousePointer, HelpCircle, Layers3, Flame, RefreshCcw,
  Grid, SlidersHorizontal, Box, Cuboid,

  // React Icons (Fa6 mappings)
  FaCrown: FaIcons.FaCrown,
  FaStar: FaIcons.FaStar,
  FaArrowRight: FaIcons.FaArrowRight,
  FaArrowUp: FaIcons.FaArrowUp,
  FaArrowDown: FaIcons.FaArrowDown,
  FaInfo: FaIcons.FaInfo,
  FaLink: FaIcons.FaLink,
  FaVideo: FaIcons.FaVideo,
  FaCircle: FaIcons.FaCircle,
  FaStairs: FaIcons.FaStairs,
  FaDoorClosed: FaIcons.FaDoorClosed,
  FaVolumeHigh: FaIcons.FaVolumeHigh,
  FaEye: FaIcons.FaEye,
  FaRotateRight: FaIcons.FaRotateRight,
  FaWandMagicSparkles: FaIcons.FaWandMagicSparkles,
  FaUpDown: FaIcons.FaUpDown,
  FaRulerCombined: FaIcons.FaRulerCombined,
  FaPalette: FaIcons.FaPalette,
  FaSliders: FaIcons.FaSliders,
  FaMusic: FaIcons.FaMusic,
  FaMicrophone: FaIcons.FaMicrophone,
  FaCommentText: FaIcons.FaComment,
  FaRepeat: FaIcons.FaRepeat,
  FaClapperboard: FaIcons.FaClapperboard,
  FaBolt: FaIcons.FaBolt,
  FaFilm: FaIcons.FaFilm,
  FaUndo: FaIcons.FaRotateLeft,
  FaWaveSquare: FaIcons.FaWaveSquare,
  FaSquare: FaIcons.FaSquare,
  FaFolderOpen: FaIcons.FaFolderOpen,
  FaBoxOpen: FaIcons.FaBoxOpen,
  FaCompress: FaIcons.FaCompress,
  FaExpand: FaIcons.FaExpand,
  FaFastBackward: FaIcons.FaBackwardFast,
  FaFastForward: FaIcons.FaForwardFast,
  FaPause: FaIcons.FaPause,
  FaPlay: FaIcons.FaPlay,
  FaChevronRight: FaIcons.FaChevronRight,
  FaChevronLeft: FaIcons.FaChevronLeft,
  FaCheck: FaIcons.FaCheck,
  FaMinus: FaIcons.FaMinus,
  FaPen: FaIcons.FaPen,
  FaLock: FaIcons.FaLock,
  FaUnlock: FaIcons.FaUnlock,
  FaEyeSlash: FaIcons.FaEyeSlash,
  FaTrashCan: FaIcons.FaTrashCan,
  FaCamera: FaIcons.FaCamera,
  FaGlobe: FaIcons.FaGlobe,
  FaExclamationTriangle: FaIcons.FaTriangleExclamation,
  FaCircleCheck: FaIcons.FaCircleCheck,
  FaArrowsSpin: FaIcons.FaRotate,
  FaVrCardboard: FaIcons.FaVrCardboard
};

const sizeMap = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  empty: 64
};

const Icon = ({ name, size = 'md', className = '', style = {}, ...props }) => {
  const IconComponent = registry[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in registry`);
    return null;
  }

  const pxSize = typeof size === 'number' ? size : (sizeMap[size] || sizeMap.md);

  return (
    <IconComponent
      size={pxSize}
      className={className}
      style={{ color: 'currentColor', verticalAlign: 'middle', ...style }}
      {...props}
    />
  );
};

export default Icon;
