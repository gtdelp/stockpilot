import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KpiCardComponent } from './kpi-card.component';

describe('KpiCardComponent', () => {
  let fixture: ComponentFixture<KpiCardComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(KpiCardComponent);
    fixture.componentRef.setInput('label', 'Ventas');
    fixture.componentRef.setInput('value', 1200);
    fixture.componentRef.setInput('previous', 1000);
    fixture.componentRef.setInput('format', 'currency');
    await fixture.whenStable();
  });

  it('calcula la tendencia respecto al periodo anterior', () => {
    const component = fixture.componentInstance;
    expect(component.trend()).toBe('up');
    expect(component.trendIsGood()).toBe(true);
    expect(component.trendText()).toContain('+20');
  });

  it('invierte el significado de la tendencia cuando se indica', async () => {
    fixture.componentRef.setInput('invertTrend', true);
    await fixture.whenStable();
    expect(fixture.componentInstance.trendIsGood()).toBe(false);
  });

  it('expone una etiqueta accesible completa', () => {
    expect(fixture.componentInstance.ariaLabel()).toMatch(/^Ventas: 1200,00/);
  });

  it('emite selected al pulsar una tarjeta seleccionable', async () => {
    fixture.componentRef.setInput('selectable', true);
    await fixture.whenStable();
    const spy = vi.fn();
    fixture.componentInstance.selected.subscribe(spy);
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
