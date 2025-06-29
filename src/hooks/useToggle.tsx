import { useState } from "react";

export const useToggle = (): [boolean, () => void] => {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => {
    setIsOpen(!isOpen);
  };
  return [isOpen, toggle];
};
