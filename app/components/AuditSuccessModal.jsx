'use client';

// app/components/AuditSuccessModal.jsx
// Version 1.0
//
// Shown after ANY completed audit (free or paid, any score — no 90+
// threshold) instead of just a toast. Gives the token creator two viral
// assets in one place:
// 1. A downloadable 400x400 PNG of their token logo with the TNT shield
//    overlaid in the corner, sized for an X/Twitter profile picture.
// 2. A copy-pasteable HTML snippet for their own site: their logo with a
//    small clickable shield badge in the corner that links back to their
//    public /audit/{ca} report page on tnt-audit.com.
//
// WHY THE LOGO GOES THROUGH /api/proxy-image: canvas.toDataURL() throws a
// SecurityError if any image drawn onto the canvas was loaded
// cross-origin without the source explicitly sending CORS headers — and
// most external logo CDNs (DexScreener's included) don't reliably do
// that. Fetching through our own /api/proxy-image route makes the image
// same-origin from the browser's point of view, so this works regardless
// of what the original CDN does or doesn't send.

import { useState } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';

const SITE_URL = 'https://tnt-audit.com';
const SHIELD_PATH = '/tnt-shield.png';

function getScoreStyle(score) {
  if (score >= 90) return { text: 'text-emerald-400', label: 'Safe' };
  if (score >= 50) return { text: 'text-yellow-400', label: 'Caution' };
  return { text: 'text-red-400', label: 'High Risk' };
}

// Draws the token logo (via our proxy, to stay same-origin) onto a 400x400
// canvas, overlays the TNT shield in the bottom-right corner, and resolves
// with a PNG data URL.
function generateBrandedLogo(logoUrl) {
  return new Promise(function (resolve, reject) {
    var canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    var ctx = canvas.getContext('2d');

    var tokenImg = new Image();
    tokenImg.crossOrigin = 'anonymous';
    tokenImg.onload = function () {
      ctx.drawImage(tokenImg, 0, 0, 400, 400);

      var shieldImg = new Image();
      shieldImg.crossOrigin = 'anonymous';
      shieldImg.onload = function () {
        var shieldSize = 120;
        var pad = 10;
        ctx.drawImage(
          shieldImg,
          400 - shieldSize - pad,
          400 - shieldSize - pad,
          shieldSize,
          shieldSize,
        );
        try {
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          reject(e);
        }
      };
      shieldImg.onerror = function () {
        reject(new Error('Failed to load TNT shield image'));
      };
      shieldImg.src = window.location.origin + SHIELD_PATH;
    };
    tokenImg.onerror = function () {
      reject(new Error('Failed to load token logo'));
    };
    tokenImg.src = '/api/proxy-image?url=' + encodeURIComponent(logoUrl);
  });
}

// token: { name, symbol, score, logoUrl, ca }
export default function AuditSuccessModal({ token, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!token) return null;

  const score = token.score || 0;
  const style = getScoreStyle(score);
  const hasLogo = !!token.logoUrl;

  const widgetCode =
    '<div style="position: relative; width: 120px; height: 120px; display: inline-block;">\n' +
    '  <img src="' +
    token.logoUrl +
    '" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" alt="Token Logo">\n' +
    '  <a href="' +
    SITE_URL +
    '/audit/' +
    token.ca +
    '" target="_blank" title="Verified by TNT House" style="position: absolute; bottom: -4px; right: -4px; width: 38px; height: 38px; cursor: pointer; transition: transform 0.2s;">\n' +
    '    <img src="' +
    SITE_URL +
    SHIELD_PATH +
    '" style="width: 100%; height: 100%;" alt="TNT Passed">\n' +
    '  </a>\n' +
    '</div>';

  const handleDownloadLogo = async function () {
    setDownloading(true);
    setDownloadError('');
    try {
      const dataUrl = await generateBrandedLogo(token.logoUrl);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = (token.symbol || 'token') + '_tnt_verified.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Branded logo generation failed:', e);
      setDownloadError('Could not generate the image. Please try again.');
    }
    setDownloading(false);
  };

  const handleCopyWidget = function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(widgetCode)
        .then(function () {
          setCopied(true);
          setTimeout(function () {
            setCopied(false);
          }, 2000);
        })
        .catch(function () {
          setDownloadError('Could not copy automatically — please select and copy manually.');
        });
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(153,69,255,0.3)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 pr-4">
            🎉 Проект успешно верифицирован TNT House!
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4 bg-slate-900/60 border border-purple-500/20 rounded-xl p-3">
          {hasLogo && (
            <img
              src={token.logoUrl}
              alt={token.symbol}
              className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/40 flex-shrink-0"
            />
          )}
          <div>
            <div className="text-white font-black text-sm">${token.symbol}</div>
            <div className={'font-black text-lg ' + style.text}>
              {style.label} {score}/100
            </div>
          </div>
        </div>

        <p className="text-slate-300 text-xs leading-relaxed mb-5">
          Покажите инвесторам, что вашему проекту можно доверять. Скачайте брендированное лого
          для профиля в X или заберите интерактивный виджет на ваш официальный сайт!
        </p>

        <button
          onClick={handleDownloadLogo}
          disabled={!hasLogo || downloading}
          className="w-full bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black py-3 rounded-lg text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-2"
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Генерируем...' : 'Скачать аватарку для X'}
        </button>
        {!hasLogo && (
          <p className="text-slate-500 text-[10px] text-center mb-3">
            Нет логотипа у этого токена — скачивание недоступно.
          </p>
        )}
        {downloadError && (
          <p className="text-red-400 text-[10px] text-center mb-3">{downloadError}</p>
        )}

        <div className="mt-4">
          <p className="text-purple-400 text-[11px] font-bold mb-1.5">
            Виджет для вашего сайта:
          </p>
          <textarea
            readOnly
            value={widgetCode}
            rows={6}
            className="w-full bg-slate-900 border border-purple-500/20 rounded-lg px-3 py-2 text-[10px] text-slate-300 font-mono resize-none focus:outline-none focus:border-purple-500"
            onClick={function (e) {
              e.target.select();
            }}
          />
          <button
            onClick={handleCopyWidget}
            className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Скопировано!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Скопировать код
              </>
            )}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 text-slate-400 hover:text-white transition text-sm"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
