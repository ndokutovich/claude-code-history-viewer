import { ChevronRight, X } from "lucide-react";
import { useToggle } from "../hooks";
import { createContext, useContext } from "react";
import { cn } from "../utils/cn";

const ContentContext = createContext<{
  isOpen: boolean;
  toggle: () => void;
  hasError?: boolean;
  enableToggle?: boolean;
}>({
  isOpen: false,
  toggle: () => {},
  hasError: false,
  enableToggle: true,
});

type ContentProviderProps = {
  children: React.ReactNode;
  hasError?: boolean;
  enableToggle?: boolean;
};

const ContentProvider = ({
  children,
  hasError,
  enableToggle,
}: ContentProviderProps) => {
  const [isOpen, toggle] = useToggle();

  return (
    <ContentContext.Provider value={{ isOpen, toggle, hasError, enableToggle }}>
      {children}
    </ContentContext.Provider>
  );
};

type RendererWrapperProps = {
  children: React.ReactNode;
  className?: string;
  hasError?: boolean;
  enableToggle?: boolean;
};

const RendererWrapper = ({
  children,
  className,
  hasError = false,
  enableToggle = true,
}: RendererWrapperProps) => {
  return (
    <ContentProvider hasError={hasError} enableToggle={enableToggle}>
      <div
        className={cn(
          "mt-2 p-3 border rounded-lg",
          className,
          hasError && "bg-red-50 border-red-200"
        )}
      >
        {children}
      </div>
    </ContentProvider>
  );
};

type RendererHeaderProps = {
  title: string;
  icon: React.ReactNode;
  titleClassName?: string;
  rightContent?: React.ReactNode;
};

const RendererHeader = ({
  title,
  icon,
  titleClassName,
  rightContent,
}: RendererHeaderProps) => {
  const { isOpen, toggle, hasError, enableToggle } = useContext(ContentContext);

  if (!enableToggle) {
    return (
      <div className={cn("flex items-center justify-between mb-2")}>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            {hasError ? <X className="w-4 h-4 text-red-500" /> : icon}
            <span
              className={cn(
                "font-medium",
                titleClassName,
                hasError && "text-red-800"
              )}
            >
              {`${title} ${hasError ? "오류" : ""}`}
            </span>
          </div>
        </div>
        {rightContent}
      </div>
    );
  }
  return (
    <div className={cn("flex items-center justify-between", isOpen && "mb-2")}>
      <div
        className="flex items-center space-x-2 cursor-pointer"
        onClick={toggle}
      >
        <ChevronRight
          className={cn(
            "p-1 rounded-full hover:bg-gray-200 transition-all duration-200",
            isOpen && "rotate-90"
          )}
        />
        <div className="flex items-center space-x-2">
          {hasError ? <X className="w-4 h-4 text-red-500" /> : icon}
          <span
            className={cn(
              "font-medium",
              titleClassName,
              hasError && "text-red-800"
            )}
          >
            {`${title} ${hasError ? "오류" : ""}`}
          </span>
        </div>
      </div>
      {rightContent}
    </div>
  );
};

type RendererContentProps = {
  children: React.ReactNode;
};

const RendererContent = ({ children }: RendererContentProps) => {
  const { isOpen, enableToggle } = useContext(ContentContext);

  if (!enableToggle) {
    return children;
  }

  return isOpen ? children : null;
};

export const Renderer = Object.assign(RendererWrapper, {
  Header: RendererHeader,
  Content: RendererContent,
});
