import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:3100/" });
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true }, HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.scrollTo = () => {};
const { render, screen, fireEvent, cleanup, waitFor, within } = await import("@testing-library/react");
const { SurveyWorkspace } = await import("../components/survey-workspace");
const { exampleSurvey, resolvedPlant, catalog, pendingPlantLabel } = await import("../lib/survey");
const { plantExplanation } = await import("../lib/plant-explanations");
const { SPECIES_REFERENCE_VERSION } = await import("../lib/species-reference-version");
const props = { onChange: () => {}, onScan: () => {}, onSave: () => {}, onPlan: () => {}, signedIn: false, busy: false };

test("complete plant profile opens in a dialog with full sections, closes safely and retains context", async () => {
  try {
    render(React.createElement(SurveyWorkspace, { ...props, survey: exampleSurvey() }));
    assert.equal(document.querySelector(".rw-photo-pair"), null);
    assert.match(document.querySelector(".rw-selected-summary")!.textContent!, /Try next:/);
    assert.equal(screen.queryByRole("dialog"), null);
    assert.ok(document.querySelector(".rw-photo"));
    const opener = screen.getByRole("button", { name: /View plant details/ });
    opener.focus(); fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog");
    assert.equal(document.body.style.overflow, "hidden");
    const topics = [...dialog.querySelectorAll("[data-plant-topic]")];
    assert.equal(topics.length, 7);
    assert(topics.every(t => t.tagName === "SECTION"), "full profile content is not hidden behind closed topics");
    assert.ok(dialog.querySelector('img[alt^="Reference specimen:"]'));
    const tabs = within(dialog).getAllByRole("tab");
    assert.equal(tabs.length, 5);
    assert.equal(tabs[0].getAttribute("aria-selected"), "true");
    assert.equal(dialog.querySelectorAll('[data-plant-topic]:not([hidden])').length, 1);
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    assert.equal(tabs[1].getAttribute("aria-selected"), "true");
    assert.equal(document.activeElement?.id, tabs[1].id);
    assert.equal(dialog.querySelector('[data-plant-topic="seasonal"]')?.hasAttribute("hidden"), false);
    fireEvent.keyDown(tabs[1], { key: "End" });
    assert.equal(tabs[4].getAttribute("aria-selected"), "true");
    assert.equal(dialog.querySelector('[data-plant-topic="sources"]')?.hasAttribute("hidden"), false);
    fireEvent.keyDown(tabs[4], { key: "Home" });
    assert.equal(tabs[0].getAttribute("aria-selected"), "true");
    assert.equal(within(dialog).getByRole("tabpanel").getAttribute("aria-labelledby"), tabs[0].id);
    assert.match(dialog.textContent!, /Match not reviewed/);
    const close = screen.getByRole("button", { name: "Close plant details" });
    assert.equal(document.activeElement?.id, tabs[0].id);
    const controls = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],summary')]
      .filter(n => !n.closest('[hidden]') && n.tabIndex >= 0 && (!n.closest('details:not([open])') || n.tagName === 'SUMMARY'));
    close.focus(); fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    assert.equal(document.activeElement?.textContent, controls.at(-1)?.textContent);
    fireEvent.keyDown(dialog, { key: "Tab" });
    assert.equal(document.activeElement?.getAttribute("aria-label"), "Close plant details");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => assert.equal(screen.queryByRole("dialog"), null));
    assert.equal(document.activeElement?.textContent, opener.textContent);
    assert.equal(document.body.style.overflow, "");
    assert.ok(screen.getByRole("heading", { name: "White Oak" }));
    fireEvent.click(screen.getByRole("button", { name: "Sources" }));
    await waitFor(() => assert.equal(document.activeElement?.id, "plant-topic-recognition-summary"));
    fireEvent.click(screen.getByRole("button", { name: "Close plant details" }));
    assert.equal(document.activeElement?.textContent?.trim(), "Sources");
    assert.equal(screen.queryByRole("button", { name: "Sign in to save" }), null);
  } finally { cleanup(); }
});

test("print includes every sourced explanation fact and glossary independent of collapsed state", () => {
  try {
    const survey = exampleSurvey();
    render(React.createElement(SurveyWorkspace, { ...props, survey }));
    fireEvent.click(screen.getByRole("button", { name: /View plant details/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Evidence & sources" }));
    const print = document.querySelector(".print-report")!;
    assert(print);
    assert.match(print.textContent!, /Generated garden illustration · authored sample plant map/);
    for (const region of survey.plants) {
      const plant = resolvedPlant(region);
      if (!plant) continue;
      for (const topic of ["recognition", "growing", "habitat", "seasonal"] as const) {
        const explanation = plantExplanation(plant, topic);
        if (!explanation) continue;
        for (const fact of explanation.facts) for (const value of fact.values) assert(print.textContent!.includes(value), `${plant.scientificName}: ${fact.field}: ${value}`);
      }
    }
    assert.match(print.textContent!, /Sources & photo credits/);
    assert.equal(print.querySelectorAll('[aria-label="Plant guide disclaimer"]').length, 1);
    assert.ok(print.querySelector('.plant-profile-source:not(details)'));
    assert.doesNotMatch(print.textContent!, /No calibrated|Cached Google|Initial AI suggestion/);
  } finally { cleanup(); }
});


test("main summary and Overview keep recognition-only records focused on learning rather than care", () => {
  const plant = catalog.find(p => p.landscapeContext?.recommendation === "recognition-only");
  assert.ok(plant);
  const survey = exampleSurvey();
  survey.source = "upload";
  survey.plants = [{ ...survey.plants[0], plantId: plant.id, scientificName: plant.scientificName, suggestion: plant.commonName, reviewed: true, yardScope: "yard" }];
  try {
    render(React.createElement(SurveyWorkspace, { ...props, survey }));
    const summary = document.querySelector(".rw-selected-summary")!;
    assert.match(summary.textContent!, /Reviewed match:/);
    assert.match(summary.textContent!, /Try next:/);
    assert.equal(document.querySelector("#plant-details .latin")?.textContent, plant.scientificName);
    fireEvent.click(screen.getByRole("button", { name: /View plant details/ }));
    assert.ok(screen.getByRole("button", { name: "Review plant match" }));
    assert.equal(screen.queryByRole("button", { name: "Explore growing requirements" }), null);
  } finally { cleanup(); }
});


test("one small review control reveals corrections without repeated provider prose", () => {
  const survey = exampleSurvey(); survey.plants[0].note = "Cached Google image suggestion; NJ local catalog; review identity.";
  try {
    render(React.createElement(SurveyWorkspace, { ...props, survey }));
    const mainActions = screen.getByLabelText("Plant identification actions");
    assert.equal(within(mainActions).getAllByRole("button").length, 2);
    assert.ok(within(mainActions).getByRole("button", { name: "Choose a different plant match" }));
    assert.ok(within(mainActions).getByRole("button", { name: "Identify from a leaf photo" }));
    fireEvent.click(screen.getByRole("button", { name: /View plant details/ }));
    const dialog = within(screen.getByRole("dialog"));
    const review = dialog.getByRole("button", { name: "Review plant match" });
    assert.equal(review.getAttribute("aria-expanded"), "false");
    assert.equal(dialog.queryByRole("button", { name: "Use a leaf photo" }), null);
    for (const tab of dialog.getAllByRole("tab")) {
      fireEvent.click(tab);
      assert.equal(dialog.getAllByRole("button", { name: "Review plant match" }).length, 1);
    }
    assert.doesNotMatch(screen.getByRole("dialog").textContent!, /Cached Google|No calibrated|Initial AI suggestion/);
    fireEvent.click(review);
    assert.ok(dialog.getByRole("button", { name: "Use a leaf photo" }));
    assert.ok(dialog.getByRole("button", { name: "Choose a plant match" }));
    assert.ok(dialog.getByRole("button", { name: "Select this match" }));
    assert.equal(screen.getByRole("dialog").querySelectorAll('[aria-label="Plant guide disclaimer"]').length, 1);
  } finally { cleanup(); }
});


test("display cleanup removes system notes while keeping useful observations", async () => {
  const { plantDisplayNote } = await import("../lib/plant-display-note");
  assert.equal(plantDisplayNote("Cached Google suggestion; NJ local catalog."), undefined);
  assert.equal(plantDisplayNote("Cached Google image suggestion. Purple flowers beside the wall."), "Purple flowers beside the wall.");
  assert.equal(plantDisplayNote("Thorns along the stems."), "Thorns along the stems.");
});


test("four ecological filters remain separate from identified NJ-pending and unidentified plants", () => {
  const survey = exampleSurvey();
  const region = survey.plants[0];
  const phlox = catalog.find(p => p.scientificName === "Hydrangea quercifolia")!;
  const named = { ...region, id: "named-pending", plantId: phlox.id, scientificName: phlox.scientificName, suggestion: phlox.commonName };
  const unknown = { ...region, id: "unidentified", plantId: undefined, scientificName: "", suggestion: "Unidentified plant" };
  assert.equal(pendingPlantLabel(named), "NJ status pending");
  assert.equal(pendingPlantLabel(unknown), "Plant not identified");
  survey.plants = [named, unknown];
  try {
    render(React.createElement(SurveyWorkspace, { ...props, survey }));
    const filters = screen.getByRole("group", { name: "Filter plants by ecological category" });
    assert.equal(within(filters).getAllByRole("button").length, 4);
    assert.ok(screen.getByLabelText("Pending verification"));
    fireEvent.click(screen.getByRole("button", { name: "Review pending plants" }));
    assert.ok(screen.getAllByText("NJ status pending").length > 0);
    assert.ok(screen.getAllByText("Plant not identified").length > 0);
    assert.equal(screen.queryByText("Unknown"), null);
  } finally { cleanup(); }
});


test("popup header keeps category text and accent across tabs without claiming an unreviewed identity", () => {
  try {
    render(React.createElement(SurveyWorkspace, { ...props, survey: exampleSurvey() }));
    fireEvent.click(screen.getByRole("button", { name: /View plant details/ }));
    const dialog = screen.getByRole("dialog");
    const header = dialog.querySelector<HTMLElement>(".rw-profile-header")!;
    assert.ok(header.classList.contains("status-keystone"));
    assert.ok(header.style.borderTopColor);
    for (const tab of within(dialog).getAllByRole("tab")) {
      fireEvent.click(tab);
      assert.equal(within(dialog).getByLabelText("Plant category").textContent, "Keystone · if matched");
      assert.ok(within(dialog).getByText("Match not reviewed"));
    }
  } finally { cleanup(); }
});


test("review submit applies a selected identity and quick selector includes background context", () => {
  try {
    const survey = exampleSurvey();
    survey.source = "upload";
    survey.plants[0].yardScope = "yard";
    survey.plants[1].yardScope = "background";
    let changed: typeof survey | undefined;
    render(React.createElement(SurveyWorkspace, { ...props, survey, onChange: next => { changed = next; } }));
    const selector = screen.getByRole("combobox", { name: "Select plant" });
    assert.equal(selector.querySelectorAll("option").length, survey.plants.length);
    fireEvent.click(screen.getByRole("button", { name: "Confirm plant match" }));
    assert.equal(changed?.plants[0].reviewed, true);
    assert.equal(changed?.plants[0].yardScope, "yard");
    assert.match(screen.getByRole("status").textContent!, /draft/);
    fireEvent.change(selector, { target: { value: survey.plants[1].id } });
    assert.ok(screen.getByRole("button", { name: "Restore to yard" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore to yard" }));
    assert.equal(changed?.plants[1].yardScope, "yard");
    assert.equal(survey.plants[1].yardScope, "background", "original history not mutated");
  } finally { cleanup(); }
});

test('out-of-catalog reference details appear without empty care boilerplate or planting admission', () => {
  try {
    const survey=exampleSurvey(); const first=survey.plants[0];
    first.plantId=undefined; first.scientificName='Imaginaris botanica'; first.suggestion='Test shrub';
    first.externalProfile={id:'api-test',apiOnly:true,referenceVersion:SPECIES_REFERENCE_VERSION,referenceExpiresAt:new Date(Date.now()+86400000).toISOString(),scientificName:first.scientificName,commonName:'Test shrub',status:'non-native',type:'Unknown',sun:'',moisture:'',height:'',bloom:'',description:'A shrub with spring flowers.',njEvidence:{assessmentStatus:'unverified',checkedOn:'2026-11-05',native:null,legalListed:false,doNotPlant:false,ecoregions:[],sources:[],note:'Not established'},referenceDetails:{facts:{Light:['Partial shade'],FlowerBloomTime:['Spring']},source:{label:'Species source',url:'https://plants.ces.ncsu.edu/plants/test/',checkedOn:'2026-11-05'}}};
    render(React.createElement(SurveyWorkspace,{...props,survey}));
    assert.ok(screen.getAllByText('A shrub with spring flowers.').length);
    assert.ok(screen.getAllByText('Partial shade').length);
    fireEvent.click(screen.getByRole('button',{name:/View plant details/}));
    const dialog=screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('tab',{name:'Growing & seasons'}));
    assert.ok(within(dialog).getByText('Partial shade'));
    assert.doesNotMatch(dialog.textContent!,/Match the plant first/);
  } finally {cleanup();}
});


test("profile identity and tabs stay outside the scrolling content and tab changes reset only content", () => {
  try {
    render(React.createElement(SurveyWorkspace, {...props, survey: exampleSurvey()}));
    fireEvent.click(screen.getByRole("button", {name:/View plant details/}));
    const dialog=screen.getByRole("dialog");
    const body=within(dialog).getByLabelText("Plant profile content");
    assert.equal(body.contains(within(dialog).getByLabelText("Plant category")), false);
    assert.equal(body.contains(within(dialog).getByRole("tablist")), false);
    assert.ok(dialog.querySelector(".rw-profile-header")?.textContent?.includes("Match not reviewed"));
    assert.doesNotMatch(dialog.querySelector(".rw-profile-header")!.textContent!, /COMPLETE PROFILE/);
    body.scrollTop=300;
    fireEvent.click(within(dialog).getByRole("tab", {name:"Growing & seasons"}));
    assert.equal(body.scrollTop,0);
    body.scrollTop=200;
    fireEvent.keyDown(within(dialog).getByRole("tab", {name:"Growing & seasons"}), {key:"ArrowRight"});
    assert.equal(body.scrollTop,0);
    assert.equal(document.activeElement?.textContent,"Ecology");
    fireEvent.keyDown(dialog,{key:"Escape"});
    assert.equal(screen.queryByRole("dialog"),null);
  } finally {cleanup();}
});


test("local map selector stays unique and Overview actions open single inline identification tools", () => {
  for (const [action, heading] of [["Identify from a leaf photo", "Leaf photo identification"], ["Choose a different plant match", "Compare plant matches"]]) {
    try {
      render(React.createElement(SurveyWorkspace, {...props,survey:exampleSurvey()}));
      const selector=screen.getByRole("combobox",{name:"Select plant"});
      assert.equal(screen.getAllByRole("combobox",{name:"Select plant"}).length,1);
      assert.ok(selector.closest(".rw-photo-toolbar"));
      assert.equal(selector.closest(".rw-heading"),null);
      fireEvent.click(screen.getByRole("button",{name:/View plant details/}));
      const dialog=screen.getByRole("dialog");
      const intro=dialog.querySelector(".rw-profile-intro")!;
      assert.ok(intro.firstElementChild?.querySelector('[data-plant-topic="about"]'));
      const actions=within(dialog).getByLabelText("Overview identification actions");
      assert.equal(within(actions).getAllByRole("button").length,2);
      fireEvent.click(within(dialog).getByRole("tab",{name:"Ecology"}));
      assert.equal(within(dialog).queryByRole("button",{name:action}),null);
      fireEvent.click(within(dialog).getByRole("tab",{name:"Overview"}));
      fireEvent.click(within(actions).getByRole("button",{name:action}));
      assert.equal(screen.queryByRole("dialog"),null);
      assert.equal(document.activeElement,screen.getByRole("heading",{name:heading}));
    } finally {cleanup();}
  }
});

test('reopening an expired saved reference refreshes it while retaining raw identified name and review scope',async()=>{
  const originalFetch=globalThis.fetch;
  try{
    const {referencePlant}=await import('../lib/survey');
    const survey=exampleSurvey();survey.source='upload';
    survey.plants=[{...survey.plants[0],plantId:undefined,scientificName:'Prunus x subhirtella',suggestion:'Winter flowering cherry',yardScope:'yard',reviewed:false,externalProfile:{...referencePlant('Prunus x subhirtella')!,referenceVersion:SPECIES_REFERENCE_VERSION,referenceExpiresAt:'2000-01-01T00:00:00Z'}}];
    let changed:typeof survey|undefined,requests=0;
    globalThis.fetch=async()=>{requests++;return Response.json({profile:{...referencePlant('Prunus × subhirtella')!,description:'A sourced hybrid tree.',referenceVersion:SPECIES_REFERENCE_VERSION,referenceExpiresAt:new Date(Date.now()+86400000).toISOString()}});};
    render(React.createElement(SurveyWorkspace,{...props,survey,onChange:next=>{changed=next;}}));
    await waitFor(()=>assert.equal(requests,1));
    await waitFor(()=>assert.ok(changed?.plants[0].externalProfile?.description));
    assert.equal(changed!.plants[0].scientificName,'Prunus x subhirtella');
    assert.equal(changed!.plants[0].reviewed,false);assert.equal(changed!.plants[0].yardScope,'yard');
    assert.equal(changed!.plants[0].externalProfile?.njEvidence?.assessmentStatus,'non-native');
  }finally{cleanup();globalThis.fetch=originalFetch;}
});

test('a newly invalid leaf file cannot retry a previous failed leaf photo',async()=>{
  const before=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({error:'Controlled leaf failure.'},{status:503});
  try{
    render(React.createElement(SurveyWorkspace,{...props,survey:exampleSurvey()}));
    fireEvent.click(within(screen.getByLabelText('Plant identification actions')).getByRole('button',{name:'Identify from a leaf photo'}));
    fireEvent.change(screen.getByLabelText('Upload a leaf photo'),{target:{files:[new File(['a'],'leaf-a.jpg',{type:'image/jpeg'})]}});
    await screen.findByRole('alert');assert.ok(screen.getByRole('button',{name:'Retry leaf photo'}));
    fireEvent.change(screen.getByLabelText('Upload a leaf photo'),{target:{files:[new File(['invalid'],'leaf-b.txt',{type:'text/plain'})]}});
    await waitFor(()=>assert.match(screen.getByRole('alert').textContent!,/Choose an image/));
    assert.equal(screen.queryByRole('button',{name:'Retry leaf photo'}),null);
  }finally{cleanup();globalThis.fetch=before;}
});
