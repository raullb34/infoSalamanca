#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para verificar códigos de municipio en archivos de escudos
basándose en el nombre del municipio (que es correcto) y encontrar el código INE correcto
"""

import os
import json
import re

def limpiar_nombre_municipio(nombre):
    """Limpia el nombre del municipio para comparación"""
    nombre = nombre.lower().strip()
    
    # Reemplazar caracteres especiales
    nombre = re.sub(r'[áàäâ]', 'a', nombre)
    nombre = re.sub(r'[éèëê]', 'e', nombre)
    nombre = re.sub(r'[íìïî]', 'i', nombre)
    nombre = re.sub(r'[óòöô]', 'o', nombre)
    nombre = re.sub(r'[úùüû]', 'u', nombre)
    nombre = re.sub(r'[ñ]', 'n', nombre)
    nombre = re.sub(r'[ç]', 'c', nombre)
    
    # Eliminar caracteres especiales y espacios extra
    nombre = re.sub(r'[^a-z0-9\s]', ' ', nombre)
    nombre = re.sub(r'\s+', ' ', nombre)
    
    return nombre.strip()

def buscar_municipio_en_ine(nombre_archivo, datos_ine):
    """Busca el municipio en los datos INE basándose en el nombre del archivo"""
    
    # Convertir nombre de archivo a nombre de municipio
    nombre_municipio = nombre_archivo.replace('_', ' ')
    
    # Variaciones del nombre para buscar
    variaciones = [
        nombre_municipio,
        nombre_municipio.replace(' de ', ' del '),
        nombre_municipio.replace(' del ', ' de '),
        nombre_municipio.replace(' la ', ' '),
        nombre_municipio.replace(' el ', ' '),
        nombre_municipio.replace(' los ', ' '),
        nombre_municipio.replace(' las ', ' ')
    ]
    
    # Buscar en los datos INE
    for entry in datos_ine:
        municipio_ine = entry.get('Municipio', '')
        municipio_ine_limpio = limpiar_nombre_municipio(municipio_ine)
        
        for variacion in variaciones:
            variacion_limpia = limpiar_nombre_municipio(variacion)
            
            # Comparación exacta
            if variacion_limpia == municipio_ine_limpio:
                return entry.get('CodMunicipio'), municipio_ine
            
            # Comparación parcial (contiene)
            if variacion_limpia in municipio_ine_limpio or municipio_ine_limpio in variacion_limpia:
                # Verificar que no sea una coincidencia muy corta
                if len(variacion_limpia) > 4 and abs(len(variacion_limpia) - len(municipio_ine_limpio)) <= 3:
                    return entry.get('CodMunicipio'), municipio_ine
    
    return None, None

def cargar_datos_ine():
    """Carga los datos del archivo INE"""
    try:
        # Buscar el archivo INE
        current_dir = os.path.dirname(os.path.abspath(__file__))
        while current_dir != os.path.dirname(current_dir):
            test_path = os.path.join(current_dir, "backend", "src", "helpers", "ine-codigopostal.json")
            if os.path.exists(test_path):
                ine_path = test_path
                break
            current_dir = os.path.dirname(current_dir)
        else:
            raise FileNotFoundError("No se encontró el archivo ine-codigopostal.json")
            
        print(f"📂 Usando archivo INE: {ine_path}")
        with open(ine_path, 'r', encoding='utf-8') as f:
            datos = json.load(f)
        
        print(f"✅ Cargados {len(datos)} registros del archivo INE")
        return datos
        
    except Exception as e:
        print(f"❌ Error cargando datos INE: {str(e)}")
        return []

def verificar_codigos_escudos():
    """Verifica los códigos de los archivos de escudos"""
    
    # Cargar datos INE
    datos_ine = cargar_datos_ine()
    if not datos_ine:
        return
    
    # Obtener archivos de escudos
    archivos_escudos = []
    for archivo in os.listdir("."):
        if archivo.endswith(('_shield.svg', '_shield.png')):
            archivos_escudos.append(archivo)
    
    print(f"📊 Analizando {len(archivos_escudos)} archivos de escudos...")
    
    correctos = []
    incorrectos = []
    no_encontrados = []
    
    for archivo in archivos_escudos:
        # Extraer código y nombre del archivo
        partes = archivo.replace('_shield.svg', '').replace('_shield.png', '').split('_', 1)
        
        if len(partes) != 2:
            print(f"❌ Formato incorrecto: {archivo}")
            continue
            
        codigo_archivo, nombre_archivo = partes
        
        # Buscar el municipio correcto en INE basándose en el nombre
        codigo_correcto, municipio_oficial = buscar_municipio_en_ine(nombre_archivo, datos_ine)
        
        if codigo_correcto is None:
            no_encontrados.append({
                'archivo': archivo,
                'codigo_archivo': codigo_archivo,
                'nombre_archivo': nombre_archivo
            })
        elif str(codigo_correcto) == codigo_archivo:
            correctos.append({
                'archivo': archivo,
                'municipio': municipio_oficial
            })
        else:
            incorrectos.append({
                'archivo': archivo,
                'codigo_actual': codigo_archivo,
                'codigo_correcto': str(codigo_correcto),
                'nombre_archivo': nombre_archivo,
                'municipio_oficial': municipio_oficial
            })
    
    # Mostrar resultados
    print("\n" + "="*80)
    print("📋 RESULTADOS DE VERIFICACIÓN DE CÓDIGOS")
    print("="*80)
    
    print(f"\n✅ ARCHIVOS CORRECTOS ({len(correctos)}):")
    for item in correctos[:10]:  # Mostrar solo los primeros 10
        print(f"   {item['archivo']} -> {item['municipio']}")
    if len(correctos) > 10:
        print(f"   ... y {len(correctos) - 10} más")
    
    if incorrectos:
        print(f"\n🔧 CÓDIGOS INCORRECTOS ({len(incorrectos)}):")
        for item in incorrectos:
            print(f"\n   📁 {item['archivo']}")
            print(f"      Código actual: {item['codigo_actual']}")
            print(f"      Código correcto: {item['codigo_correcto']}")
            print(f"      Municipio: {item['municipio_oficial']}")
    
    if no_encontrados:
        print(f"\n⚠️  NO ENCONTRADOS EN INE ({len(no_encontrados)}):")
        for item in no_encontrados:
            print(f"   {item['archivo']} (buscando: {item['nombre_archivo']})")
    
    print(f"\n📊 RESUMEN:")
    print(f"   ✅ Correctos: {len(correctos)}")
    print(f"   🔧 Códigos incorrectos: {len(incorrectos)}")
    print(f"   ⚠️  No encontrados: {len(no_encontrados)}")
    
    # Preguntar si corregir
    if incorrectos:
        print(f"\n❓ ¿Corregir los {len(incorrectos)} códigos incorrectos? (s/n): ", end="")
        respuesta = input().lower().strip()
        
        if respuesta in ['s', 'si', 'sí', 'y', 'yes']:
            corregir_codigos(incorrectos)

def corregir_codigos(incorrectos):
    """Corrige los códigos de los archivos"""
    
    print(f"\n🔄 Corrigiendo {len(incorrectos)} archivos...")
    
    exitosos = 0
    errores = 0
    
    for item in incorrectos:
        archivo_actual = item['archivo']
        
        # Crear nuevo nombre con código correcto
        extension = '.svg' if archivo_actual.endswith('.svg') else '.png'
        nuevo_nombre = f"{item['codigo_correcto']}_{item['nombre_archivo']}_shield{extension}"
        
        try:
            if os.path.exists(archivo_actual):
                if os.path.exists(nuevo_nombre):
                    print(f"⚠️  Ya existe: {nuevo_nombre}")
                    continue
                
                os.rename(archivo_actual, nuevo_nombre)
                print(f"✅ {archivo_actual} -> {nuevo_nombre}")
                exitosos += 1
            else:
                print(f"❌ No encontrado: {archivo_actual}")
                errores += 1
                
        except Exception as e:
            print(f"❌ Error: {archivo_actual} - {str(e)}")
            errores += 1
    
    print(f"\n📊 Correcciones completadas:")
    print(f"   ✅ Exitosas: {exitosos}")
    print(f"   ❌ Errores: {errores}")

def main():
    """Función principal"""
    print("🔍 VERIFICADOR DE CÓDIGOS DE MUNICIPIO EN ESCUDOS")
    print("="*55)
    print("Este script verifica que los códigos INE en los nombres")
    print("de archivos correspondan al municipio correcto.\n")
    
    verificar_codigos_escudos()

if __name__ == "__main__":
    main()
