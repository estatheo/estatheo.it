#!/usr/bin/env bash
# Builds the browser engine in doom/ from source: doomgeneric (as vendored in claude-doom) plus
# doomgeneric_web.c, compiled to WebAssembly with Emscripten. Also copies the Freedoom IWAD and
# its licence next to it, unchanged.
#
#   doom/src/build.sh [path to a claude-doom checkout]
#
# The checkout defaults to ~/gascity/github/proj/claude-doom. The published build used
# github.com/estatheo/claude-doom at commit 265ca581e006f55aaaf90dbc0fc4a9de58e0fee1
# and Emscripten 7.0.0 (brew install emscripten). Writes doom/engine.js, doom/engine.wasm,
# doom/freedoom1.wad and doom/FREEDOOM-COPYING.txt. Nothing in the checkout is changed.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(dirname "$HERE")"
CD="${1:-$HOME/gascity/github/proj/claude-doom}"
DG="$CD/vendor/doomgeneric/doomgeneric"
[ -f "$DG/doomgeneric.c" ] || { echo "no doomgeneric sources at $DG" >&2; exit 1; }
[ -f "$CD/wad/freedoom1.wad" ] || { echo "no Freedoom IWAD at $CD/wad (run its fetch-wad.sh)" >&2; exit 1; }

# The engine files, as in claude-doom's engine/Makefile; no SDL, no sound, no network.
SRC="dummy am_map doomdef doomstat dstrings d_event d_items d_iwad d_loop d_main d_mode d_net
  f_finale f_wipe g_game hu_lib hu_stuff info i_cdmus i_endoom i_joystick i_scale i_sound i_system
  i_timer memio m_argv m_bbox m_cheat m_config m_controls m_fixed m_menu m_misc m_random p_ceilng
  p_doors p_enemy p_floor p_inter p_lights p_map p_maputl p_mobj p_plats p_pspr p_saveg p_setup
  p_sight p_spec p_switch p_telept p_tick p_user r_bsp r_data r_draw r_main r_plane r_segs r_sky
  r_things sha1 sounds statdump st_lib st_stuff s_sound tables v_video wi_stuff w_checksum w_file
  w_main w_wad z_zone w_file_stdc i_input i_video doomgeneric"
FILES=()
for f in $SRC; do FILES+=("$DG/$f.c"); done

BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT
emcc -O2 -w -DNORMALUNIX -DLINUX -D_DEFAULT_SOURCE \
  -DDOOMGENERIC_RESX=320 -DDOOMGENERIC_RESY=200 -I"$DG" \
  "${FILES[@]}" "$HERE/doomgeneric_web.c" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createDoom -sENVIRONMENT=web \
  -sINVOKE_RUN=0 -sEXIT_RUNTIME=0 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 \
  -sFORCE_FILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=FS,callMain,HEAPU8 \
  -sEXPORTED_FUNCTIONS=_main,_dg_tick,_dg_key,_dg_screen \
  -o "$BUILD/engine.js"

cp "$BUILD/engine.js" "$BUILD/engine.wasm" "$OUT/"
cp "$CD/wad/freedoom1.wad" "$OUT/freedoom1.wad"
cp "$CD/wad/FREEDOOM-COPYING.txt" "$OUT/FREEDOOM-COPYING.txt"
cmp -s "$CD/wad/freedoom1.wad" "$OUT/freedoom1.wad"
ls -l "$OUT/engine.js" "$OUT/engine.wasm" "$OUT/freedoom1.wad"
