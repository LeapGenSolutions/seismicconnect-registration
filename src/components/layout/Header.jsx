import { Bell } from "lucide-react";
import { useSelector } from "react-redux";
import { Link, useLocation } from "wouter";

const Header = () => {
  const [location] = useLocation();
  const user = useSelector((state) => state.me.me);

  const isActive = (path) => location === path;

  return (
    <header className="bg-white border-b border-neutral-200">
      {/* Make it a single row by default, allow wrap only when it gets really tight */}
      <div className="px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">

        {/* --- Left Navigation --- */}
        <nav
          className="
            order-2 sm:order-1
            flex items-center gap-1
            whitespace-nowrap overflow-x-auto
            max-w-full
            flex-1 min-w-0
          "
        >
          <Link
            href="/documentation"
            className={`px-2 sm:px-3 py-1 text-sm sm:text-base cursor-pointer transition-colors ${isActive("/documentation")
              ? "font-bold underline underline-offset-4 text-black"
              : "text-neutral-600 hover:text-black"
              }`}
          >
            Documentation
          </Link>

          <Link
            href="/connect"
            className={`px-2 sm:px-3 py-1 text-sm sm:text-base transition-colors ${isActive("/connect")
              ? "font-bold underline underline-offset-4 text-black"
              : "text-neutral-600 hover:text-black"
              }`}
          >
            Connect
          </Link>

          <Link
            href="/about"
            className={`px-2 sm:px-3 py-1 text-sm sm:text-base transition-colors ${isActive("/about")
              ? "font-bold underline underline-offset-4 text-black"
              : "text-neutral-600 hover:text-black"
              }`}
          >
            About Us
          </Link>

          <Link
            href="/contact"
            className={`px-2 sm:px-3 py-1 text-sm sm:text-base transition-colors ${isActive("/contact")
              ? "font-bold underline underline-offset-4 text-black"
              : "text-neutral-600 hover:text-black"
              }`}
          >
            Contact Us
          </Link>
        </nav>

        {/* --- Right: Notifications + User --- */}
        <div
          className="
            order-1 sm:order-2
            flex items-center gap-2 sm:gap-3
            flex-shrink-0
          "
        >
          {/* Clinic Name */}
          {user && (
            <span className="text-sm font-medium text-neutral-600">
              {user.clinicName || "Clinic Not Set"}
            </span>
          )}

          {/* Bell Icon */}
          <button className="p-1.5 sm:p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-full">
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* User Avatar + Info */}
          <div className="flex items-center">
            {user?.profileImage ? (
              <img
                src={user.profileImage}
                alt="User avatar"
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium text-sm">
                {user?.given_name?.charAt(0) || "U"}
              </div>
            )}

            <div className="ml-2">
              <p className="text-xs sm:text-sm font-medium text-neutral-800">
                {user?.given_name || "Loading..."}
              </p>
              {/* Hide role on very small screens to save height */}
              <p className="text-xs text-neutral-500">
                {user?.role || "Staff"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header

