import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";

type Props = {
  children: React.ReactNode;
  content: React.ComponentProps<typeof TooltipPrimitive.Content>;
} & Omit<React.ComponentProps<"button">, "children" | "title">;

export const TooltipButton = ({ children, content, ...props }: Props) => {
  // Extract aria-label from content if it's a string, otherwise use provided aria-label
  const ariaLabel = props["aria-label"] || (typeof content === "string" ? content : undefined);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button {...props} aria-label={ariaLabel}>{children}</button>
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
};
