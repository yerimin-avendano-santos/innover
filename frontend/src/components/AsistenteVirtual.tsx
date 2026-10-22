'use client';

// ========================================
// 🤖 ASISTENTE VIRTUAL INNOVER
// ========================================
// Widget flotante de asistencia interactiva para orientación
// inmobiliaria en Huánuco y soporte en la plataforma.

import { useState, useRef, useEffect, useCallback } from 'react';

interface Mensaje {
  id: string;
  remitente: 'asistente' | 'usuario';
  texto: string;
  hora: string;
}

const PREGUNTAS_SUGERIDAS = [
  '¿Cuáles son las zonas más cotizadas en Huánuco?',
  '¿Cómo puedo publicar mi propiedad?',
  '¿Qué incluye el Plan PRO con Tour 3D?',
  'Busco departamentos en alquiler',
];

export function AsistenteVirtual() {
  const [abierto, setAbierto] = useState(false);
  const [entrada, setEntrada] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const contadorId = useRef(1);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: 'bienvenida',
      remitente: 'asistente',
      texto:
        '¡Hola! Soy el Asistente Virtual de INNOVER. Estoy aquí para ayudarte a explorar casas, departamentos y terrenos en Huánuco, Amarilis y Pillco Marca, o asistirte en la publicación de tu inmueble. ¿En qué te puedo orientar hoy?',
      hora: 'Ahora',
    },
  ]);

  const finalMensajesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll al final del chat
  useEffect(() => {
    if (abierto) {
      finalMensajesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, escribiendo, abierto]);

  // Enfocar input al abrir
  useEffect(() => {
    if (abierto) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [abierto]);

  const responderPregunta = useCallback((textoPregunta: string) => {
    contadorId.current += 1;
    const idUsuario = `usr-${contadorId.current}`;
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Mensaje del usuario
    const nuevoUsuario: Mensaje = {
      id: idUsuario,
      remitente: 'usuario',
      texto: textoPregunta,
      hora,
    };

    setMensajes((prev) => [...prev, nuevoUsuario]);
    setEntrada('');
    setEscribiendo(true);

    // Generar respuesta contextual realista
    setTimeout(() => {
      contadorId.current += 1;
      const idBot = `bot-${contadorId.current}`;
      let respuesta =
        'Comprendo tu consulta. En INNOVER puedes usar el buscador con mapa en tiempo real y filtrar por tipo de operación (Venta o Alquiler) y distrito. ¿Deseas que te oriente en algún inmueble específico?';

      const q = textoPregunta.toLowerCase();

      if (q.includes('zona') || q.includes('cotizada') || q.includes('huanuco') || q.includes('huánuco')) {
        respuesta =
          'Las zonas con mayor movimiento inmobiliario en Huánuco son la conurbación de Amarilis (Paucarbamba, Paucarbambilla), el centro histórico cerca de la Plaza de Armas, y Pillco Marca (Cayhuayna). Los precios por metro cuadrado oscilan entre S/ 1,800 y S/ 3,500.';
      } else if (q.includes('publicar') || q.includes('vender') || q.includes('alquilar')) {
        respuesta =
          '¡Publicar es muy fácil! Puedes hacer clic en el botón naranja "+ Publicar propiedad" en la barra superior. Solo necesitas título, descripción, precio, fotos (puedes arrastrarlas directo) y marcar su ubicación en el mapa.';
      } else if (q.includes('pro') || q.includes('3d') || q.includes('destacado') || q.includes('recorrido')) {
        respuesta =
          'El Plan PRO te permite agregar un Recorrido Virtual 3D interactivo (compatible con Matterport y Sketchfab) y destacar tu anuncio con prioridad en los primeros resultados del mapa con distintivo ámbar.';
      } else if (q.includes('amarilis') || q.includes('casa')) {
        respuesta =
          'En Amarilis tenemos actualmente opciones destacadas tanto en venta como en alquiler. Puedes seleccionar "Amarilis" en el filtro de distritos de la barra superior para ver las chinchetas exactas en el mapa.';
      } else if (q.includes('departamento') || q.includes('alquiler')) {
        respuesta =
          'En la barra de filtros activa la pastilla "Alquiler" y en Tipo elige "Departamentos". Verás instantáneamente los precios actualizados en soles y dólares.';
      }

      const nuevoBot: Mensaje = {
        id: idBot,
        remitente: 'asistente',
        texto: respuesta,
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMensajes((prev) => [...prev, nuevoBot]);
      setEscribiendo(false);
    }, 900);
  }, []);

  const manejarEnvio = (e: React.FormEvent) => {
    e.preventDefault();
    const textoLimpio = entrada.trim();
    if (!textoLimpio) return;
    responderPregunta(textoLimpio);
  };

  return (
    <>
      {/* Botón flotante siempre accesible en la esquina inferior derecha */}
      <div className="fixed bottom-6 right-18 z-40 flex items-center gap-3">
        {!abierto && (
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-linea bg-white/95 px-3.5 py-1.5 shadow-md backdrop-blur-xs transition hover:shadow-lg">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-micro font-medium text-tinta">¿Dudas? Chatea con nosotros</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAbierto((prev) => !prev)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#0F5C63] text-white shadow-xl transition-all duration-200 hover:scale-105 hover:bg-[#0B4A50] focus:ring-4 focus:ring-teal-500/30"
          aria-label={abierto ? 'Cerrar asistente virtual' : 'Abrir asistente virtual de Innover'}
          title="Asistente Virtual INNOVER"
        >
          {abierto ? (
            <svg viewBox="0 0 16 16" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          ) : (
            <>
              {/* Icono de Asistente IA */}
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 transition-transform group-hover:scale-110"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="14" r="1.5" fill="currentColor" />
                <circle cx="15" cy="14" r="1.5" fill="currentColor" />
                <path d="M10 18h4" strokeLinecap="round" />
              </svg>
              {/* Indicador de estado activo */}
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
              </span>
            </>
          )}
        </button>
      </div>

      {/* Ventana de Chat del Asistente */}
      {abierto && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[510px] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-linea bg-white shadow-2xl transition-all sm:right-6">
          {/* Cabecera del chat */}
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#0B4A50] to-[#0F5C63] px-4 py-3.5 text-white">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 2v4M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7z" />
                  <circle cx="9" cy="14" r="1" fill="currentColor" />
                  <circle cx="15" cy="14" r="1" fill="currentColor" />
                </svg>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0F5C63] bg-emerald-400" />
              </div>
              <div>
                <h3 className="text-menor font-bold leading-tight">AGENTE INNOVER</h3>
                <p className="text-micro text-teal-200">Asistente inmobiliario virtual</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
              aria-label="Cerrar chat"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Área de mensajes con scroll */}
          <div className="flex-1 overflow-y-auto bg-[#F4F7F8] p-4 space-y-3.5">
            {mensajes.map((m) => {
              const esBot = m.remitente === 'asistente';
              return (
                <div key={m.id} className={`flex ${esBot ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                      esBot
                        ? 'rounded-tl-xs border border-linea bg-white text-tinta'
                        : 'rounded-tr-xs bg-[#0F5C63] text-white'
                    }`}
                  >
                    <p className="text-menor leading-relaxed">{m.texto}</p>
                    <span
                      className={`mt-1 block text-right text-[10px] ${
                        esBot ? 'text-tinta-50' : 'text-teal-200'
                      }`}
                    >
                      {m.hora}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Indicador de escritura animado */}
            {escribiendo && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-xs border border-linea bg-white px-3.5 py-2 shadow-2xs">
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#0F5C63]/60" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#0F5C63]/60 [animation-delay:0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#0F5C63]/60 [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={finalMensajesRef} />
          </div>

          {/* Preguntas sugeridas */}
          {mensajes.length <= 3 && !escribiendo && (
            <div className="border-t border-linea/60 bg-[#F4F7F8] px-3 py-2">
              <p className="mb-1.5 text-[11px] font-medium text-tinta-50">Sugerencias rápidas:</p>
              <div className="flex flex-wrap gap-1.5">
                {PREGUNTAS_SUGERIDAS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => responderPregunta(p)}
                    className="rounded-full border border-linea bg-white px-2.5 py-1 text-micro text-tinta hover:border-senal hover:text-senal transition-colors text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Campo de entrada de texto */}
          <form onSubmit={manejarEnvio} className="border-t border-linea bg-white p-2.5">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                placeholder="Escribe tu consulta…"
                className="campo flex-1 rounded-full py-2 pl-3.5 pr-3 text-menor placeholder:text-slate-400 focus:border-senal focus:ring-2 focus:ring-teal-500/20"
              />
              <button
                type="submit"
                disabled={!entrada.trim() || escribiendo}
                className="btn-coral flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-xs disabled:opacity-40 transition-transform active:scale-95"
                title="Enviar mensaje"
                aria-label="Enviar mensaje"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                  <path d="M1.724 1.053a.5.5 0 0 0-.714.545l1.403 4.85a.5.5 0 0 0 .397.354l5.69 1.198-5.69 1.198a.5.5 0 0 0-.397.354l-1.403 4.85a.5.5 0 0 0 .714.545l13-6.5a.5.5 0 0 0 0-.894l-13-6.5z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

