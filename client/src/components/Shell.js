import TopNav from './TopNav';
import BottomNav from './BottomNav';
import { useApp } from '../context/AppContext';

// The frame around every page that has navigation: the top bar, and on phones
// the bottom tab bar, with room left under the page so the bar never covers it.
export default function Shell({ children }) {
  const { hideTabBar } = useApp();
  return (
    <>
      <TopNav />
      <div className={hideTabBar ? '' : 'pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0'}>
        {children}
      </div>
      <BottomNav />
    </>
  );
}
