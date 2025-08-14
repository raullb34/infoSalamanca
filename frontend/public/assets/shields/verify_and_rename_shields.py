#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para verificar y corregir los nombres de archivos de escudos
basándose en el archivo INE oficial
"""

import os
import json
import re
import shutil

def limpiar_nombre_municipio(nombre):
    """Limpia el nombre del municipio para comparación"""
    # Convertir a minúsculas
    nombre = nombre.lower().strip()
    
    # Eliminar artículos al principio
    for articulo in ['el ', 'la ', 'los ', 'las ']:
        if nombre.startswith(articulo):
            nombre = nombre[len(articulo):]
    
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

def nombre_para_archivo(nombre):
    """Convierte nombre de municipio a formato de archivo"""
    nombre_limpio = limpiar_nombre_municipio(nombre)
    return nombre_limpio.replace(' ', '_')

def cargar_datos_ine():
    """Carga los datos del archivo INE"""
    try:
        # Buscar el archivo INE en diferentes ubicaciones posibles
        rutas_posibles = [
            "../../../backend/src/helpers/ine-codigopostal.json",
            "../../../../backend/src/helpers/ine-codigopostal.json",
            "../../../../../../backend/src/helpers/ine-codigopostal.json"
        ]
        
        ine_path = None
        for ruta in rutas_posibles:
            if os.path.exists(ruta):
                ine_path = ruta
                break
        
        if not ine_path:
            # Buscar desde la raíz del proyecto
            current_dir = os.path.dirname(os.path.abspath(__file__))
            while current_dir != os.path.dirname(current_dir):  # Hasta llegar a la raíz
                test_path = os.path.join(current_dir, "backend", "src", "helpers", "ine-codigopostal.json")
                if os.path.exists(test_path):
                    ine_path = test_path
                    break
                current_dir = os.path.dirname(current_dir)
        
        if not ine_path:
            raise FileNotFoundError("No se encontró el archivo ine-codigopostal.json")
            
        print(f"📂 Usando archivo INE: {ine_path}")
        with open(ine_path, 'r', encoding='utf-8') as f:
            datos = json.load(f)
        
        # Crear mapeo código -> municipio y municipio -> código
        codigo_a_municipio = {}
        municipio_a_codigo = {}
        
        for entry in datos:
            codigo = str(entry.get('CodMunicipio', ''))
            municipio = entry.get('Municipio', '')
            
            if codigo and municipio:
                codigo_a_municipio[codigo] = municipio
                # Usar nombre limpio para la búsqueda
                nombre_limpio = limpiar_nombre_municipio(municipio)
                municipio_a_codigo[nombre_limpio] = codigo
        
        print(f"✅ Cargados {len(codigo_a_municipio)} municipios del archivo INE")
        return codigo_a_municipio, municipio_a_codigo
        
    except Exception as e:
        print(f"❌ Error cargando datos INE: {str(e)}")
        return {}, {}

def analizar_escudos_existentes():
    """Analiza los archivos de escudos existentes"""
    shields_dir = "."
    archivos_escudos = []
    
    for archivo in os.listdir(shields_dir):
        if archivo.endswith(('_shield.svg', '_shield.png')):
            archivos_escudos.append(archivo)
    
    print(f"📊 Encontrados {len(archivos_escudos)} archivos de escudos")
    return archivos_escudos

def verificar_y_corregir_nombres(archivos_escudos, codigo_a_municipio, municipio_a_codigo):
    """Verifica y corrige los nombres de los archivos de escudos"""
    
    problemas = []
    correcciones = []
    
    for archivo in archivos_escudos:
        # Extraer código y nombre del archivo
        partes = archivo.replace('_shield.svg', '').replace('_shield.png', '').split('_', 1)
        
        if len(partes) != 2:
            problemas.append(f"❌ Formato incorrecto: {archivo}")
            continue
            
        codigo_archivo, nombre_archivo = partes
        
        # Verificar si el código existe en INE
        if codigo_archivo in codigo_a_municipio:
            municipio_oficial = codigo_a_municipio[codigo_archivo]
            nombre_oficial_limpio = nombre_para_archivo(municipio_oficial)
            
            # Comparar nombres
            if nombre_archivo != nombre_oficial_limpio:
                extension = '.svg' if archivo.endswith('.svg') else '.png'
                nombre_correcto = f"{codigo_archivo}_{nombre_oficial_limpio}_shield{extension}"
                
                correcciones.append({
                    'archivo_actual': archivo,
                    'archivo_correcto': nombre_correcto,
                    'municipio_oficial': municipio_oficial,
                    'codigo': codigo_archivo
                })
        else:
            # Buscar por nombre si el código no coincide
            nombre_limpio = limpiar_nombre_municipio(nombre_archivo.replace('_', ' '))
            
            if nombre_limpio in municipio_a_codigo:
                codigo_correcto = municipio_a_codigo[nombre_limpio]
                municipio_oficial = codigo_a_municipio[codigo_correcto]
                
                extension = '.svg' if archivo.endswith('.svg') else '.png'
                nombre_correcto = f"{codigo_correcto}_{nombre_para_archivo(municipio_oficial)}_shield{extension}"
                
                correcciones.append({
                    'archivo_actual': archivo,
                    'archivo_correcto': nombre_correcto,
                    'municipio_oficial': municipio_oficial,
                    'codigo': codigo_correcto,
                    'problema': f"Código incorrecto: {codigo_archivo} -> {codigo_correcto}"
                })
            else:
                problemas.append(f"❌ No encontrado en INE: {archivo} (código: {codigo_archivo}, nombre: {nombre_archivo})")
    
    return problemas, correcciones

def mostrar_resultados(problemas, correcciones):
    """Muestra los resultados del análisis"""
    
    print("\n" + "="*80)
    print("📋 RESULTADOS DEL ANÁLISIS")
    print("="*80)
    
    if problemas:
        print(f"\n🚨 PROBLEMAS ENCONTRADOS ({len(problemas)}):")
        for problema in problemas:
            print(f"   {problema}")
    
    if correcciones:
        print(f"\n🔧 CORRECCIONES NECESARIAS ({len(correcciones)}):")
        for i, correccion in enumerate(correcciones, 1):
            print(f"\n{i}. {correccion['archivo_actual']}")
            print(f"   -> {correccion['archivo_correcto']}")
            print(f"   Municipio oficial: {correccion['municipio_oficial']}")
            print(f"   Código: {correccion['codigo']}")
            if 'problema' in correccion:
                print(f"   Problema: {correccion['problema']}")
    
    if not problemas and not correcciones:
        print("\n✅ ¡Todos los archivos tienen nombres correctos!")
    
    return len(correcciones)

def aplicar_correcciones(correcciones):
    """Aplica las correcciones renombrando los archivos"""
    
    if not correcciones:
        return
    
    print(f"\n🔄 Aplicando {len(correcciones)} correcciones...")
    
    exitosos = 0
    errores = 0
    
    for correccion in correcciones:
        archivo_actual = correccion['archivo_actual']
        archivo_correcto = correccion['archivo_correcto']
        
        try:
            # Verificar que el archivo actual existe
            if os.path.exists(archivo_actual):
                # Verificar que el nuevo nombre no existe ya
                if os.path.exists(archivo_correcto):
                    print(f"⚠️  El archivo {archivo_correcto} ya existe, omitiendo...")
                    continue
                
                # Renombrar archivo
                os.rename(archivo_actual, archivo_correcto)
                print(f"✅ {archivo_actual} -> {archivo_correcto}")
                exitosos += 1
            else:
                print(f"❌ Archivo no encontrado: {archivo_actual}")
                errores += 1
                
        except Exception as e:
            print(f"❌ Error renombrando {archivo_actual}: {str(e)}")
            errores += 1
    
    print(f"\n📊 Resumen de correcciones:")
    print(f"   ✅ Exitosos: {exitosos}")
    print(f"   ❌ Errores: {errores}")

def main():
    """Función principal"""
    print("🔍 VERIFICADOR DE NOMBRES DE ESCUDOS")
    print("="*50)
    
    # Cargar datos INE
    codigo_a_municipio, municipio_a_codigo = cargar_datos_ine()
    
    if not codigo_a_municipio:
        print("❌ No se pudieron cargar los datos INE")
        return
    
    # Analizar escudos existentes
    archivos_escudos = analizar_escudos_existentes()
    
    if not archivos_escudos:
        print("❌ No se encontraron archivos de escudos")
        return
    
    # Verificar y encontrar correcciones
    problemas, correcciones = verificar_y_corregir_nombres(
        archivos_escudos, codigo_a_municipio, municipio_a_codigo
    )
    
    # Mostrar resultados
    num_correcciones = mostrar_resultados(problemas, correcciones)
    
    # Preguntar si aplicar correcciones
    if num_correcciones > 0:
        print(f"\n❓ ¿Aplicar las {num_correcciones} correcciones? (s/n): ", end="")
        respuesta = input().lower().strip()
        
        if respuesta in ['s', 'si', 'sí', 'y', 'yes']:
            aplicar_correcciones(correcciones)
            print("\n🎉 ¡Correcciones aplicadas!")
        else:
            print("\n📝 Correcciones no aplicadas. Puedes ejecutar el script de nuevo cuando quieras.")

if __name__ == "__main__":
    main()
