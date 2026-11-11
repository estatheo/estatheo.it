// doomgeneric backend for a web page (Emscripten, no SDL).
//
// Copyright (C) 2026 Theodor Chichirita. Licensed under the GNU GPL, version 2, on the same
// terms as doomgeneric: see ../LICENSE-GPL-2.0.txt. Built by ./build.sh against the doomgeneric sources vendored in
// github.com/estatheo/claude-doom (vendor/doomgeneric/doomgeneric).
//
// The page (js/doom.js) drives everything:
// - it writes the IWAD into the in-memory file system and calls main(), which only sets
//   the game up (doomgeneric_Create) and returns;
// - it calls dg_tick() once for each new game tic (35 a second) while the game may run, then
//   copies the 320x200 XRGB frame at dg_screen() onto a canvas;
// - it sends key presses and releases with dg_key(), already as Doom key codes;
// - the clock is the page's: Module.dgNow() is milliseconds of play time, which stops while
//   the game is paused (released, off screen, or in a hidden tab), so Doom never tries to
//   catch up on time it did not see.
// There is no sound: the engine is built without it.

#include <stdint.h>
#include <emscripten.h>

#include "doomgeneric.h"

EM_JS(double, page_now, (void), { return Module.dgNow(); });

#define QUEUE 64
static struct { unsigned char key; unsigned char pressed; } queue[QUEUE];
static int q_head, q_tail;

EMSCRIPTEN_KEEPALIVE void dg_key(int pressed, int key)
{
    int next = (q_tail + 1) % QUEUE;
    if (next == q_head) return; // full: drop the key rather than overwrite one not read yet
    queue[q_tail].key = (unsigned char)key;
    queue[q_tail].pressed = pressed ? 1 : 0;
    q_tail = next;
}

EMSCRIPTEN_KEEPALIVE void dg_tick(void) { doomgeneric_Tick(); }

EMSCRIPTEN_KEEPALIVE pixel_t *dg_screen(void) { return DG_ScreenBuffer; }

void DG_Init(void) {}

void DG_DrawFrame(void) {} // the page reads DG_ScreenBuffer after each dg_tick()

void DG_SleepMs(uint32_t ms) { (void)ms; } // never block the page; it calls dg_tick() when a tic is due

uint32_t DG_GetTicksMs(void) { return (uint32_t)page_now(); }

int DG_GetKey(int *pressed, unsigned char *key)
{
    if (q_head == q_tail) return 0;
    *pressed = queue[q_head].pressed;
    *key = queue[q_head].key;
    q_head = (q_head + 1) % QUEUE;
    return 1;
}

void DG_SetWindowTitle(const char *title) { (void)title; }

int main(int argc, char **argv)
{
    doomgeneric_Create(argc, argv);
    return 0;
}
