'use client';

// ========================================
// 🧮 SIMULADOR / CALCULADORA HIPOTECARIA
// ========================================
// Herramienta puramente de cliente para calcular cuotas referenciales
// sobre inmuebles en venta, usando el sistema francés de amortización.

import { useState, useId } from 'react';
import { formatearPrecio } from '@/lib/api';

interface Props {
  precio: number;
  moneda: 'PEN' | 'USD';
}

export default function CalculadoraHipotecaria({ precio, moneda }: Props) {
  const [porcentajeInicial, setPorcentajeInicial] = useState<number>(20);
  const [plazoAnios, setPlazoAnios] = useState<number>(20);
  const [tasaAnual, setTasaAnual] = useState<number>(8.5);

  const idInicial = useId();
  const idPlazo = useId();
  const idTasa = useId();

  // Cálculos financieros estándar
  const cuotaInicial = Math.round((precio * porcentajeInicial) / 100);
  const montoFinanciar = Math.max(0, precio - cuotaInicial);
  const meses = plazoAnios * 12;
  const tasaMensual = tasaAnual / 100 / 12;

  let cuotaMensual = 0;
  if (tasaMensual > 0 && meses > 0 && montoFinanciar > 0) {
    const factor = Math.pow(1 + tasaMensual, meses);
    cuotaMensual = Math.round((montoFinanciar * (tasaMensual * factor)) / (factor - 1));
  }

  return (
    <div className="mt-8 rounded-grande border border-linea bg-papel-alto p-5">
      <div className="mb-4 flex items-center justify-between border-b border-linea pb-3">
        <div>
          <span className="distintivo distintivo-neutro">Simulador</span>
          <h3 className="mt-1 text-grande font-semibold text-tinta">
            Calculadora de Cuota Estimada
          </h3>
        </div>
        <div className="text-right">
          <p className="text-micro text-tinta-50">Cuota mensual aprox.</p>
          <p className="cifra text-display font-semibold text-senal">
            {formatearPrecio(cuotaMensual, moneda)}
            <span className="text-cuerpo font-normal text-tinta-50">/mes</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Cuota inicial */}
        <div>
          <label htmlFor={idInicial} className="block text-micro font-medium text-tinta-70">
            Cuota inicial ({porcentajeInicial}%)
          </label>
          <div className="mt-1 flex gap-1">
            {[10, 20, 30].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setPorcentajeInicial(pct)}
                className={`flex-1 rounded-chico py-1 text-menor font-medium transition ${
                  porcentajeInicial === pct
                    ? 'bg-senal text-white'
                    : 'bg-papel-hundido text-tinta hover:bg-linea'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
          <p className="cifra mt-1 text-micro text-tinta-50">
            {formatearPrecio(cuotaInicial, moneda)}
          </p>
        </div>

        {/* Plazo en años */}
        <div>
          <label htmlFor={idPlazo} className="block text-micro font-medium text-tinta-70">
            Plazo de pago
          </label>
          <div className="mt-1 flex gap-1">
            {[15, 20, 25].map((anios) => (
              <button
                key={anios}
                type="button"
                onClick={() => setPlazoAnios(anios)}
                className={`flex-1 rounded-chico py-1 text-menor font-medium transition ${
                  plazoAnios === anios
                    ? 'bg-senal text-white'
                    : 'bg-papel-hundido text-tinta hover:bg-linea'
                }`}
              >
                {anios} años
              </button>
            ))}
          </div>
          <p className="cifra mt-1 text-micro text-tinta-50">{meses} cuotas mensuales</p>
        </div>

        {/* Tasa referencial */}
        <div>
          <label htmlFor={idTasa} className="block text-micro font-medium text-tinta-70">
            Tasa referencial (TEA %)
          </label>
          <input
            id={idTasa}
            type="number"
            min="1"
            max="30"
            step="0.1"
            value={tasaAnual}
            onChange={(e) => setTasaAnual(Math.max(0.1, Number(e.target.value) || 0))}
            className="campo mt-1 py-1 text-cuerpo text-tinta"
          />
          <p className="mt-1 text-micro text-tinta-50">Tasa anual promedio en Perú</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between border-t border-linea pt-3 text-micro text-tinta-50">
        <span>Monto a financiar: <strong className="cifra font-medium text-tinta">{formatearPrecio(montoFinanciar, moneda)}</strong></span>
        <span>*Cálculo referencial informativo sin valor contractual.</span>
      </div>
    </div>
  );
}
