import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Shield } from 'lucide-react';
import LanguageSwitch from '../ui/LanguageSwitch';

import { useAuth } from '@/contexts/AuthContext';

const DesktopNav = () => {
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();

  const navItems = [
    { label: t('home'), path: '/' },
    { label: t('Travel Mode'), path: '/travel', hidden: user?.role === 'guardian' },
    { label: t('safeZones'), path: '/safe-zones' },

    { label: t('profile'), path: '/profile' },
  ].filter(item => !item.hidden);

  return (
    <nav className="top-nav hidden md:block">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">NaariSecure</span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Language Switch */}
          <LanguageSwitch />
        </div>
      </div>
    </nav>
  );
};

export default DesktopNav;
