/** Página leve: ícones com poucos elementos e a vitrine da tela inicial. */
import { describe, expect, it } from 'vitest';
import { cubeIcon, megaminxIcon, mergePaths, pyraminxIcon, skewbIcon } from '../src/core/icons';
import { isSoftwareRenderer, showcaseOrder, weakDevice } from '../src/ui/home';

const count = (svg: string) => (svg.match(/<(path|polygon)\b/g) ?? []).length;

describe('ícones dos puzzles', () => {
  it('juntar os adesivos não muda o desenho', () => {
    const raw = '<path d="M1Z" fill="#a"/><path d="M2Z" fill="#a"/><path d="M3Z" fill="#b"/><polygon points="1"/><path d="M4Z" fill="#a"/>';
    expect(mergePaths(raw)).toBe('<path d="M1ZM2Z" fill="#a"/><path d="M3Z" fill="#b"/><polygon points="1"/><path d="M4Z" fill="#a"/>');
  });
  it('cada ícone tem poucos elementos (a página inicial mostra vários)', () => {
    for (const svg of [cubeIcon(2), cubeIcon(3), cubeIcon(5), cubeIcon(7), pyraminxIcon(), skewbIcon(), megaminxIcon()]) expect(count(svg)).toBeLessThan(40);
    // o 7x7 continua com os 147 adesivos, só que em 3 desenhos
    expect((cubeIcon(7).match(/M/g) ?? []).length).toBe(147);
  });
});

describe('vitrine da tela inicial', () => {
  const ids = ['cube2', 'cube3', 'cube4', 'cube5', 'cube6', 'cube7', 'pyraminx', 'skewb', 'megaminx'];
  it('começa pelo 3x3 e não repete o anterior', () => {
    const next = showcaseOrder(ids, false);
    let last = next();
    expect(last).toBe('cube3');
    for (let i = 0; i < 50; i++) {
      const id = next();
      expect(id).not.toBe(last);
      last = id;
    }
  });
  it('em aparelho fraco, pula os puzzles pesados', () => {
    const next = showcaseOrder(ids, true);
    const seen = new Set(Array.from({ length: 200 }, next));
    expect([...seen].sort()).toEqual(['cube2', 'cube3', 'cube4', 'cube5', 'pyraminx', 'skewb']);
  });
  it('sem placa de vídeo, a vitrine fica parada', () => {
    expect(isSoftwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')).toBe(true);
    expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
    expect(isSoftwareRenderer('ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)')).toBe(true);
    expect(isSoftwareRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
    expect(isSoftwareRenderer('Apple GPU')).toBe(false);
    expect(isSoftwareRenderer('Adreno (TM) 640')).toBe(false);
    expect(isSoftwareRenderer('')).toBe(false);
  });
  it('aparelho fraco: até 4 núcleos ou 4 GB', () => {
    expect(weakDevice({ hardwareConcurrency: 4 })).toBe(true);
    expect(weakDevice({ hardwareConcurrency: 8, deviceMemory: 2 })).toBe(true);
    expect(weakDevice({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe(false);
    expect(weakDevice({})).toBe(false);
  });
});
