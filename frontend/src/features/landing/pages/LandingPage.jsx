import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import brandLogo from '../../../assets/logo.png';
import Spatial360Background from '../components/Spatial360Background';
import { getTours, createTour } from '../../dashboard/services/tour.service';
import { useAppVersion } from '../../../constants/version';
import '../styles/LandingPage.css';

// Framer Motion Staggered Variants
const heroContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05
    }
  }
};

const fadeUpVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 280,
      damping: 24
    }
  }
};

export default function LandingPage() {
  const navigate = useNavigate();
  const appVersion = useAppVersion();
  const [launching, setLaunching] = useState(false);

  // Single Action Handler: Navigates directly to the Tour Editor path
  const handleLaunchStudio = async () => {
    if (launching) return;
    setLaunching(true);
    try {
      sessionStorage.setItem('wox_entered_studio', 'true');
    } catch {}
    try {
      const tours = await getTours();
      if (Array.isArray(tours) && tours.length > 0) {
        const targetId = tours[0].id || tours[0]._id;
        navigate(`/editor/${targetId}`);
      } else {
        const newTour = await createTour({ title: 'WoX 360 Virtual Experience', scenes: [] });
        const targetId = newTour?.id || newTour?._id;
        if (targetId) {
          navigate(`/editor/${targetId}`);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error('Error opening editor:', err);
      navigate('/dashboard');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="landing-container">
      {/* 360° Interactive Canvas Particle & Orbit Background */}
      <Spatial360Background />

      {/* Ambient Lighting Background */}
      <div className="landing-ambient-glow" />

      {/* Top Navbar */}
      <motion.header 
        className="landing-navbar"
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="landing-nav-logo" onClick={handleLaunchStudio}>
          <img 
            src={brandLogo} 
            alt="WoX BUILDER Logo" 
            style={{ height: 38, width: 'auto', display: 'block' }} 
          />
        </div>

        <motion.button 
          className="landing-nav-btn"
          onClick={handleLaunchStudio}
          disabled={launching}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
        >
          {launching ? 'Opening Editor...' : 'Create Tour Editor'}
        </motion.button>
      </motion.header>

      {/* Main Single-Screen Content */}
      <motion.main 
        className="landing-main"
        variants={heroContainerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* 360° Spatial Radar Badge */}
        <motion.div className="landing-360-badge" variants={fadeUpVariants}>
          <div className="landing-360-compass">
            <div className="landing-360-needle" />
          </div>
          <span>360° SPATIAL VIRTUAL TOUR PLATFORM</span>
        </motion.div>

        <motion.h1 className="landing-headline" variants={fadeUpVariants}>
          Architect & Publish Interactive<br />360° Virtual Tours
        </motion.h1>

        <motion.p className="landing-subheadline" variants={fadeUpVariants}>
          An interactive WebGL studio to author 360° virtual tours, position spatial hotspots, 
          link architectural floorplans, and export standalone web packages.
        </motion.p>

        {/* Single Action Button */}
        <motion.div className="landing-actions" variants={fadeUpVariants}>
          <motion.button 
            className="landing-btn-primary"
            onClick={handleLaunchStudio}
            disabled={launching}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ padding: '16px 40px', fontSize: '16px' }}
          >
            {launching ? 'Opening Tour Editor...' : 'Create Tour Editor'}
          </motion.button>
        </motion.div>


      </motion.main>

      {/* Minimal Footer */}
      <motion.footer 
        className="landing-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <span className="landing-footer-text">
          © {new Date().getFullYear()} WoX BUILDER. All rights reserved.
        </span>
        <span className="landing-footer-text">{appVersion}</span>
      </motion.footer>
    </div>
  );
}
