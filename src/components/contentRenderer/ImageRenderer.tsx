import React, { useState } from "react";
import { Image, ZoomIn, Download, X } from "lucide-react";

interface ImageRendererProps {
  imageUrl: string;
  alt?: string;
}

export const ImageRenderer: React.FC<ImageRendererProps> = ({
  imageUrl,
  alt = "Claude generated image",
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleDownload = () => {
    if (imageUrl.startsWith("data:image/")) {
      // base64 이미지 다운로드
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `claude-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // 외부 URL 이미지
      window.open(imageUrl, "_blank");
    }
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  if (imageError) {
    return (
      <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-center">
        <div className="flex items-center justify-center mb-2">
          <Image className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">이미지를 로드할 수 없습니다</p>
        <p className="text-xs text-gray-400 mt-1 break-all">{imageUrl}</p>
      </div>
    );
  }

  return (
    <>
      {/* 이미지 컨테이너 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 my-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Image className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">이미지</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={openModal}
              className="p-1 rounded hover:bg-gray-200 transition-colors"
              title="전체 화면으로 보기"
            >
              <ZoomIn className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={handleDownload}
              className="p-1 rounded hover:bg-gray-200 transition-colors"
              title="이미지 다운로드"
            >
              <Download className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 이미지 미리보기 */}
        <div className="relative group">
          <img
            src={imageUrl}
            alt={alt}
            onError={handleImageError}
            onClick={openModal}
            className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            style={{ maxHeight: "400px", objectFit: "contain" }}
          />

          {/* 호버 오버레이 */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-white bg-opacity-90 rounded-full p-2">
              <ZoomIn className="w-5 h-5 text-gray-700" />
            </div>
          </div>
        </div>
      </div>

      {/* 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-screen-lg max-h-screen-lg">
            {/* 닫기 버튼 */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 bg-white bg-opacity-90 rounded-full p-2 hover:bg-opacity-100 transition-all z-10"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>

            {/* 다운로드 버튼 */}
            <button
              onClick={handleDownload}
              className="absolute top-4 right-16 bg-white bg-opacity-90 rounded-full p-2 hover:bg-opacity-100 transition-all z-10"
            >
              <Download className="w-5 h-5 text-gray-700" />
            </button>

            {/* 전체 화면 이미지 */}
            <img
              src={imageUrl}
              alt={alt}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={closeModal}
            />
          </div>
        </div>
      )}
    </>
  );
};
