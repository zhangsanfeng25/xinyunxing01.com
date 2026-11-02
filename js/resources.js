(() => {
  "use strict";
  const labels = { prompt: "提示词", code: "代码", skill: "SKILL", link: "链接" };
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== void 0) n.textContent = text;
    return n;
  };
  const btn = (text, action, cls = "secondary") => {
    const b = el("button", cls, text);
    b.type = "button";
    b.addEventListener("click", action);
    return b;
  };
  const image = (p, title) => {
    const n = el("img");
    if (p.url.startsWith('/api/v1/files/')) window.loadPrivateImage(n, p.url);
    else n.src = p.url;
    n.alt = title;
    n.loading = "lazy";
    n.referrerPolicy = "no-referrer";
    n.addEventListener("error", () => {
      n.replaceWith(el("p", "image-unavailable", "预览暂不可用"));
    }, { once: true });
    return n;
  };
  const date = (s) => new Date(s).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  const tags = (item) => {
    const h = el("div", "resource-tags");
    for (const kind of item.materialTypes ?? []) h.append(el("span", "resource-tag", labels[kind]));
    if (item.previews?.some((p) => p.animated)) h.append(el("span", "resource-tag", "动图"));
    return h;
  };
  window.resourceCard = (item, navigate) => {
    const c = el("article", "resource-card");
    const link = el("a", "resource-card-link");
    link.href = "#/designs/" + item.id;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(link.hash);
    });
    if (item.previews?.length) link.append(image(item.previews[0], item.title));
    else {
      const t = el("div", "resource-text-preview");
      t.append(el("span", "", labels[item.materialTypes?.[0]] || item.categoryName), el("p", "", item.description || item.title));
      link.append(t);
    }
    link.append(el("h2", "", item.title));
    const foot = el("div", "resource-card-footer");
    foot.append(tags(item), el("time", "resource-date", date(item.createdAt)));
    link.append(foot);
    c.append(link);
    return c;
  };
  window.createResourcesUI = ({ root, request, fileRequest, getMember, getEpoch, navigate }) => {
    let generation = 0, categories = [], draft = null, initial = "", busy = false, active = false, currentRoute = null, query = "", category = "", material = "", cursor = null, rows = [];
    const alive = (g, e, id) => active && g === generation && e === getEpoch() && id === getMember()?.id;
    const editable = (r) => getMember()?.role === "admin" || getMember()?.role === "member" && r.authorId === getMember().id;
    const status = () => {
      let p = root.querySelector("[role=status]");
      if (!p) {
        p = el("p", "resource-status");
        p.setAttribute("role", "status");
        root.append(p);
      }
      return p;
    };
    const dirty = () => !!draft && JSON.stringify(draft) !== initial;
    const confirmLeave = () => {
      if (busy) return false;
      if (dirty()) {
        if (!window.confirm("放弃尚未保存的修改？")) return false;
        initial = JSON.stringify(draft);
      }
      return true;
    };
    window.addEventListener("beforeunload", (e) => {
      if (dirty() || busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    const field = (name, type, value, change, max) => {
      const l = el("label", "resource-field", name), n = el(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") n.type = type;
      n.value = value ?? "";
      if (max) n.maxLength = max;
      n.addEventListener("input", () => change(n.value));
      l.append(n);
      return l;
    };
    function heading(title, back) {
      const h = el("header", "resource-heading");
      if (back) h.append(btn("← 返回", () => navigate(back), "resource-back"));
      h.append(el("h1", "", title));
      root.append(h);
      return h;
    }
    function gallery(append = false) {
      if (!append) {
        root.replaceChildren();
        document.body.classList.remove("resource-focus");
        const h = heading("设计参考");
        const search = el("form", "resource-search"), input = el("input");
        input.type = "search";
        input.placeholder = "搜索界面、效果、提示词";
        input.setAttribute("aria-label", "搜索设计参考");
        input.maxLength = 60;
        input.value = query;
        search.append(input, btn("搜索", () => {
          query = input.value.trim();
          loadList();
        }));
        search.addEventListener("submit", (e) => {
          e.preventDefault();
          query = input.value.trim();
          loadList();
        });
        h.append(search);
        if (getMember()?.role !== "guest") h.append(btn("＋ 添加资源", () => navigate("#/designs/new"), "publish-button"));
        const filters = el("div", "resource-filters");
        const cats = el("div", "resource-categories");
        for (const c of [{ id: "", name: "全部" }, ...categories]) {
          const b = btn(c.name, () => {
            category = String(c.id);
            loadList();
          });
          b.classList.toggle("active", String(c.id) === category);
          b.setAttribute("aria-pressed", String(String(c.id) === category));
          cats.append(b);
        }
        const select = el("select");
        select.setAttribute("aria-label", "材料类型");
        for (const [v, t] of [["", "全部材料"], ...Object.entries(labels)]) {
          const o = el("option", "", t);
          o.value = v;
          select.append(o);
        }
        select.value = material;
        select.addEventListener("change", () => {
          material = select.value;
          loadList();
        });
        filters.append(cats, select);
        if (getMember()?.role === "admin") filters.append(btn("管理分类", manageCategories));
        root.append(filters, el("div", "resource-grid"));
      }
      const grid = root.querySelector(".resource-grid");
      grid.replaceChildren(...rows.map((r) => window.resourceCard(r, navigate)));
      status().textContent = rows.length ? "" : "暂无设计参考";
      root.querySelector(".resource-more")?.remove();
      if (cursor) root.append(btn("加载更多", () => loadList(true), "secondary resource-more"));
    }
    async function loadList(append = false) {
      const g = ++generation, e = getEpoch(), id = getMember()?.id;
      if (!append) {
        rows = [];
        cursor = null;
      }
      gallery();
      status().textContent = "正在加载…";
      const p = new URLSearchParams({ q: query, categoryId: category, material });
      if (append && cursor) p.set("cursor", cursor);
      try {
        const r = await request("/api/v1/design-resources?" + p);
        if (!alive(g, e, id)) return;
        rows = append ? [...rows, ...r.items] : r.items;
        cursor = r.nextCursor;
        gallery();
      } catch (error) {
        if (alive(g, e, id)) {
          status().textContent = error.message;
          status().append(btn("重试", () => loadList(append)));
        }
      }
    }
    async function manageCategories() {
      const box = el("dialog", "resource-category-dialog");
      box.append(el("h2", "", "管理分类"));
      for (const c of categories) {
        const row = el("form", "category-edit"), input = el("input");
        input.value = c.name;
        input.maxLength = 24;
        input.required = true;
        input.setAttribute("aria-label", "分类名称");
        const save2 = el("button", "", "保存");
        save2.type = "submit";
        row.append(input, save2);
        row.addEventListener("submit", async (e) => {
          e.preventDefault();
          save2.disabled = true;
          try {
            const result = await request("/api/v1/design-categories/" + c.id, "PATCH", { name: input.value, version: c.version });
            Object.assign(c, result);
            message.textContent = "已保存";
          } catch (error) {
            message.textContent = error.message;
          } finally {
            save2.disabled = false;
          }
        });
        box.append(row);
      }
      const add = el("form", "category-edit"), name = el("input");
      name.placeholder = "新分类";
      name.setAttribute("aria-label", "新分类名称");
      name.maxLength = 24;
      name.required = true;
      const save = el("button", "", "添加");
      save.type = "submit";
      add.append(name, save);
      add.addEventListener("submit", async (e) => {
        e.preventDefault();
        save.disabled = true;
        try {
          await request("/api/v1/design-categories", "POST", { name: name.value });
          box.close();
          await enter(currentRoute);
        } catch (error) {
          message.textContent = error.message;
          save.disabled = false;
        }
      });
      const message = el("p");
      message.setAttribute("role", "status");
      box.append(add, message, btn("关闭", () => {
        box.close();
        gallery();
      }));
      box.addEventListener("close", () => box.remove(), { once: true });
      document.body.append(box);
      box.showModal();
    }
    function previewPane(r) {
      const host = el("div", "resource-preview-pane");
      if (!r.previews.length) return host;
      const main = el("div", "resource-main-image"), thumbs = el("div", "resource-thumbnails");
      const show = (p) => {
        main.replaceChildren(image(p, r.title));
        thumbs.querySelectorAll("button").forEach((b, i) => {
          b.classList.toggle("active", r.previews[i] === p);
          b.setAttribute("aria-pressed", String(r.previews[i] === p));
        });
      };
      for (const [i, p] of r.previews.entries()) {
        const b = btn("", () => show(p));
        b.setAttribute("aria-label", "预览 " + (i + 1));
        b.append(image(p, r.title));
        thumbs.append(b);
      }
      host.append(main, thumbs);
      show(r.previews[0]);
      return host;
    }
    function detail(r) {
      root.replaceChildren();
      document.body.classList.add("resource-focus");
      const h = heading(r.title, "#/view/designs");
      if (editable(r)) h.append(btn("编辑", () => navigate("#/designs/" + r.id + "/edit"), "publish-button"));
      if (getMember()?.role === "admin") h.append(btn("删除", async () => {
        if (!window.confirm("删除这条设计参考？")) return;
        try {
          await request("/api/v1/design-resources/" + r.id, "DELETE", { version: r.version });
          navigate("#/view/designs");
        } catch (error) {
          status().textContent = error.message;
        }
      }));
      const meta = el("div", "resource-detail-meta");
      meta.append(el("span", "resource-category", r.categoryName), tags(r));
      root.append(meta);
      if (r.description) root.append(el("p", "resource-description", r.description));
      const layout = el("div", "resource-detail-grid");
      if (r.previews.length) layout.append(previewPane(r));
      else layout.classList.add("text-only");
      const materials = el("div", "resource-materials");
      for (const [i, m] of r.materials.entries()) {
        const section = el("details", "material-section");
        section.open = i === 0 || m.kind === "code" && window.innerWidth > 760;
        const summary = el("summary");
        summary.append(el("h2", "", m.title || labels[m.kind]));
        if (m.language) summary.append(el("span", "resource-tag", m.language));
        section.append(summary);
        if (m.kind === "link") {
          const a = el("a", "material-link", m.url);
          a.href = m.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          section.append(a);
          if (m.body) section.append(el("p", "", m.body));
        } else {
          const copy = btn("复制", async () => {
            try {
              await navigator.clipboard.writeText(m.body);
              copy.textContent = "已复制";
            } catch {
              copy.textContent = "复制失败，请选中文本复制";
            }
          }, "secondary copy-material");
          const pre = el("pre", m.kind === "code" ? "material-code" : "material-text");
          pre.append(el("code", "", m.body));
          section.append(copy, pre);
        }
        materials.append(section);
      }
      if (r.tags.length) {
        const t = el("div", "resource-tags");
        r.tags.forEach((v) => t.append(btn(v, () => {
          query = "";
          category = "";
          material = "";
          query = v;
          navigate("#/view/designs");
        }, "resource-tag")));
        materials.append(t);
      }
      layout.append(materials);
      root.append(layout);
    }
    function editor(r) {
      draft = structuredClone(r ?? { title: "", description: "", categoryId: categories[0]?.id, tags: [], materials: [], previews: [] });
      initial = JSON.stringify(draft);
      root.replaceChildren();
      document.body.classList.add("resource-focus");
      const form = el("form", "resource-editor");
      const h = el("header", "resource-heading");
      h.append(btn("取消", () => navigate(r ? "#/designs/" + r.id : "#/view/designs"), "resource-back"), el("h1", "", r ? "编辑资源" : "添加资源"));
      const save = el("button", "publish-button", "保存");
      save.type = "submit";
      h.append(save);
      form.append(h);
      const layout = el("div", "resource-edit-grid"), left = el("section", "resource-edit-left"), right = el("section", "resource-edit-right");
      const title = field("标题", "text", draft.title, (v) => draft.title = v, 60);
      title.querySelector("input").required = true;
      const cat = el("label", "resource-field", "分类"), select = el("select");
      categories.forEach((c) => {
        const o = el("option", "", c.name);
        o.value = c.id;
        select.append(o);
      });
      select.value = draft.categoryId;
      select.addEventListener("change", () => draft.categoryId = Number(select.value));
      cat.append(select);
      right.append(title, cat);
      const previewTitle = el("h2", "", "预览"), previews = el("div", "resource-edit-previews");
      left.append(previewTitle, previews);
      const drawPreviews = () => {
        previews.replaceChildren();
        draft.previews.forEach((p, i) => {
          const card = el("div", "preview-edit-card");
          card.append(image(p, draft.title), btn("×", () => {
            draft.previews.splice(i, 1);
            drawPreviews();
          }, "remove-preview"));
          card.lastChild.setAttribute("aria-label", "移除预览 " + (i + 1));
          previews.append(card);
        });
      };
      drawPreviews();
      const files = el("input");
      files.type = "file";
      files.accept = "image/jpeg,image/png,image/webp,image/gif";
      files.multiple = true;
      files.hidden = true;
      const upload = btn("＋ 添加图片", () => files.click(), "secondary resource-upload");
      files.addEventListener("change", async () => {
        const selected = [...files.files];
        if (selected.length + draft.previews.length > 4) {
          status().textContent = "最多 4 张预览";
          return;
        }
        busy = true;
        save.disabled = upload.disabled = true;
        const g = generation, epoch = getEpoch(), id = getMember()?.id;
        try {
          for (const file of selected) {
            if (file.size > 1e7) throw Error("图片不能超过 10 MB");
            const response = await fileRequest("/api/v1/files/design-previews", { method: "POST", headers: { "Content-Type": file.type, "Idempotency-Key": crypto.randomUUID(), "X-Forum-CSRF": "1" }, body: file });
            const result = await response.json();
            if (!response.ok) throw Error(result.error || result.message || "上传失败");
            if (!alive(g, epoch, id)) return;
            draft.previews.push({ fileId: result.id, url: result.url, animated: !!result.animated });
            drawPreviews();
          }
          status().textContent = "";
        } catch (error) {
          if (alive(g, epoch, id)) status().textContent = error.message;
        } finally {
          busy = false;
          save.disabled = upload.disabled = false;
          files.value = "";
        }
      });
      left.append(files, upload);
      const urlBox = field("图片 / GIF 链接", "url", "", () => {
      }, 2048);
      const addUrl = btn("添加链接预览", () => {
        const input = urlBox.querySelector("input");
        if (!input.value || !input.reportValidity()) return;
        if (draft.previews.length >= 4) {
          status().textContent = "最多 4 张预览";
          return;
        }
        try {
          const u = new URL(input.value);
          if (!["https:", "http:"].includes(u.protocol) || u.username || u.password) throw 0;
          draft.previews.push({ url: u.href, animated: /\.gif(?:$|\?)/i.test(u.href) });
          input.value = "";
          drawPreviews();
        } catch {
          status().textContent = "请输入有效的图片链接";
        }
      });
      left.append(urlBox, addUrl, field("简介", "textarea", draft.description, (v) => draft.description = v, 300), field("标签", "text", draft.tags.join("，"), (v) => draft.tags = v.split(/[,，]/).map((t) => t.trim()).filter(Boolean), 200));
      const mh = el("div", "resource-material-heading");
      mh.append(el("h2", "", "材料"));
      const choose = el("select");
      choose.setAttribute("aria-label", "添加材料类型");
      choose.append(el("option", "", "添加材料"));
      for (const [v, t] of Object.entries(labels)) {
        const o = el("option", "", t);
        o.value = v;
        choose.append(o);
      }
      mh.append(choose);
      const materials = el("div", "resource-materials");
      right.append(mh, materials);
      const drawMaterials = (openIndex = 0) => {
        materials.replaceChildren();
        draft.materials.forEach((m, i) => {
          const block = el("details", "material-section");
          block.open = i === openIndex;
          const summary = el("summary");
          summary.append(el("h2", "", labels[m.kind]), btn("移除", () => {
            draft.materials.splice(i, 1);
            drawMaterials(Math.max(0, i - 1));
          }));
          block.append(summary, field("名称", "text", m.title, (v) => m.title = v, 80));
          if (m.kind === "link") block.append(field("链接", "url", m.url, (v) => m.url = v, 2048));
          if (m.kind === "code") block.append(field("语言", "text", m.language, (v) => m.language = v, 30));
          if (m.kind !== "link") block.append(field("内容", "textarea", m.body, (v) => m.body = v, m.kind === "prompt" ? 12e3 : 2e4));
          materials.append(block);
        });
      };
      choose.addEventListener("change", () => {
        const kind = choose.value;
        if (!labels[kind]) return;
        if (kind !== "link" && draft.materials.some((m) => m.kind === kind)) {
          status().textContent = "已添加" + labels[kind];
          choose.selectedIndex = 0;
          return;
        }
        if (draft.materials.length >= 8) {
          status().textContent = "最多 8 份材料";
          return;
        }
        draft.materials.push({ kind, title: "", body: "", url: "", language: "" });
        drawMaterials(draft.materials.length - 1);
        choose.selectedIndex = 0;
      });
      drawMaterials();
      layout.append(left, right);
      form.append(layout);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (busy) return;
        busy = true;
        save.disabled = true;
        const g = generation, epoch = getEpoch(), id = getMember()?.id;
        const payload = { title: draft.title, description: draft.description, categoryId: draft.categoryId, tags: draft.tags, materials: draft.materials, previews: draft.previews.map((p) => p.fileId ? { fileId: p.fileId } : { url: p.url, animated: p.animated }), ...r ? { version: r.version } : {} };
        try {
          const result = await request("/api/v1/design-resources" + (r ? "/" + r.id : ""), r ? "PATCH" : "POST", payload);
          if (!alive(g, epoch, id)) return;
          initial = JSON.stringify(draft);
          draft = null;
          busy = false;
          navigate("#/designs/" + result.id);
        } catch (error) {
          if (alive(g, epoch, id)) status().textContent = error.message;
        } finally {
          busy = false;
          save.disabled = false;
        }
      });
      root.append(form);
      status();
    }
    async function enter(route = { kind: "view", view: "designs" }) {
      active = true;
      currentRoute = route;
      draft = null;
      const g = ++generation, e = getEpoch(), id = getMember()?.id;
      root.replaceChildren(el("p", "", "正在加载…"));
      try {
        const [c, r] = await Promise.all([request("/api/v1/design-categories"), route.id ? request("/api/v1/design-resources/" + route.id) : Promise.resolve(null)]);
        if (!alive(g, e, id)) return;
        categories = c.items;
        if (route.kind === "design-new" || route.kind === "design-edit") {
          if (getMember()?.role === "guest" || r && !editable(r)) throw Error("没有编辑权限");
          editor(r);
        } else if (r) detail(r);
        else await loadList();
        root.querySelector("h1")?.setAttribute("tabindex", "-1");
        root.querySelector("h1")?.focus({ preventScroll: true });
      } catch (error) {
        if (alive(g, e, id)) {
          root.replaceChildren(el("h1", "", "设计参考"), el("p", "", error.message), btn("返回设计参考", () => navigate("#/view/designs")));
        }
      }
    }
    return { enter, confirmLeave, currentHash() {
      return currentRoute?.kind === "design-new" ? "#/designs/new" : currentRoute?.id ? "#/designs/" + currentRoute.id + (currentRoute.kind === "design-edit" ? "/edit" : "") : "#/view/designs";
    }, leave() {
      active = false;
      generation++;
      draft = null;
      root.replaceChildren();
      document.body.classList.remove("resource-focus");
    }, reset() {
      active = false;
      generation++;
      draft = null;
      busy = false;
      rows = [];
      categories = [];
      query = category = material = "";
      root.replaceChildren();
      document.body.classList.remove("resource-focus");
    } };
  };
  window.createResourceHome = ({ root, request, getMember, getEpoch, navigate, onView }) => {
    let generation = 0;
    return { reset() {
      generation++;
      root.replaceChildren();
    }, async enter() {
      const g = ++generation, e = getEpoch(), id = getMember()?.id;
      root.replaceChildren();
      root.append(el("h1", "", "首页"));
      const search = el("form", "home-search"), input = el("input");
      input.type = "search";
      input.placeholder = "搜索网站、设计参考";
      input.setAttribute("aria-label", "搜索网站、设计参考");
      input.maxLength = 60;
      const send = el("button", "publish-button", "搜索");
      search.append(input, send);
      root.append(search);
      const content = el("div", "home-sections");
      root.append(content);
      search.addEventListener("submit", (event) => {
        event.preventDefault();
        load(input.value.trim());
      });
      async function load(q = "") {
        const n = ++generation;
        content.replaceChildren(el("p", "", "正在加载…"));
        try {
          const outcomes = await Promise.allSettled([q ? request("/api/v1/websites?limit=24&q=" + encodeURIComponent(q)) : request("/api/v1/website-categories").then(async (c) => ({ items: (await Promise.all(c.items.slice(0, 4).map((c2) => request("/api/v1/websites?limit=3&categoryId=" + c2.id)))).flatMap((r) => r.items) })), request("/api/v1/design-resources?limit=6&q=" + encodeURIComponent(q)), request("/api/v1/posts?limit=2&sort=newest&filter=all")]);
          const [sites, designs, posts] = outcomes.map((r) => r.status === "fulfilled" ? r.value : { items: [], error: r.reason?.message || "加载失败" });
          if (n !== generation || e !== getEpoch() || id !== getMember()?.id) return;
          content.replaceChildren();
          const section = (title, view) => {
            const s = el("section", "home-section"), head = el("header", "section-heading");
            head.append(el("h2", "", title), btn("更多 →", () => onView(view), "text-button"));
            s.append(head);
            content.append(s);
            return s;
          };
          const websites = section(q ? "网站搜索结果" : "常用网站", "websites"), groups = el("div", "home-site-groups");
          const grouped = /* @__PURE__ */ new Map();
          for (const s of sites.items.slice(0, 24)) {
            const key = s.categoryName || "网站";
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(s);
          }
          for (const [name, values] of [...grouped].slice(0, 4)) {
            const box = el("div", "home-site-group");
            box.append(el("h3", "", name));
            for (const s of values.slice(0, 3)) {
              const a = el("a", "home-site");
              a.href = s.url;
              a.target = "_blank";
              a.rel = "noopener noreferrer";
              if (s.logoPath || s.logoUrl) {
                const img = image({ url: s.logoPath || s.logoUrl }, "");
                a.append(img);
            } else a.append(el("span", "home-site-initial", [...s.name][0]));
              a.append(el("span", "", s.name));
              a.addEventListener("click", () => {
                request("/api/v1/websites/" + s.id + "/clicks", "POST", {}).catch(() => {
                });
              });
              box.append(a);
            }
            groups.append(box);
          }
          websites.append(groups);
          if (sites.error) websites.append(el("p", "", sites.error), btn("重试网站", () => load(q)));
          else if (!sites.items.length) websites.append(el("p", "", "没有找到网站"));
          const ds = section(q ? "设计搜索结果" : "最新设计参考", "designs"), grid = el("div", "resource-grid");
          designs.items.slice(0, 3).forEach((r) => grid.append(window.resourceCard(r, navigate)));
          ds.append(grid);
          if (designs.error) ds.append(el("p", "", designs.error), btn("重试设计参考", () => load(q)));
          else if (!designs.items.length) ds.append(el("p", "", "暂无设计参考"));
          if (!q) {
            const ps = section("最新留言", "discussions"), list = el("div", "home-messages");
            posts.items.slice(0, 2).forEach((p) => list.append(btn(p.authorName + " · " + date(p.createdAt) + "\n" + p.title, () => navigate("#/posts/" + p.id), "home-message")));
            ps.append(list);
            if (posts.error) ps.append(el("p", "", posts.error), btn("重试留言", () => load(q)));
          }
        } catch (error) {
          if (n === generation) {
            content.replaceChildren(el("p", "", error.message), btn("重试", () => load(q)));
          }
        }
      }
      await load();
    } };
  };
  window.createBoardReplies = ({ request, getMember, getEpoch, actions, putIcons }) => {
    const readers = /* @__PURE__ */ new Set();
    const draw = (post, host) => {
      let open = false, loaded = false, cursor = null, loading = false;
      const toggle = btn("回复" + (post.replyCount ? " " + post.replyCount : ""), async () => {
        open = !open;
        panel.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        if (open && !loaded) await load();
      }, "board-reply-toggle");
      const replyLabel = el("span", "", toggle.textContent), replyIcon = el("span");
      replyIcon.dataset.icon = "message-square";
      toggle.replaceChildren(replyIcon, replyLabel);
      putIcons(toggle);
      toggle.setAttribute("aria-expanded", "false");
      const panel = el("section", "board-replies");
      panel.hidden = true;
      const list = el("div"), message = el("p");
      message.setAttribute("role", "status");
      const more = btn("更多回复", () => load(true));
      more.hidden = true;
      panel.append(list, more, message);
      const epoch = getEpoch(), identity = getMember()?.id, valid = () => epoch === getEpoch() && identity === getMember()?.id && host.isConnected;
      async function load(append = false) {
        if (loading) return;
        loading = true;
        try {
          const r = await request("/api/v1/posts/" + post.id + "/replies" + (append && cursor ? "?cursor=" + encodeURIComponent(cursor) : ""));
          if (!valid()) return;
          if (!append) list.replaceChildren();
          for (const reply of r.items) {
            const row = el("article", "board-reply");
            row.append(el("strong", "", reply.authorName), el("p", "", reply.body), actions("replies", reply));
            list.append(row);
          }
          cursor = r.nextCursor;
          more.hidden = !cursor;
          loaded = true;
          message.textContent = "";
        } catch (error) {
          if (valid()) {
            message.textContent = error.message;
            message.append(btn("重试", () => load(append)));
          }
        } finally {
          loading = false;
        }
      }
      readers.add(async () => {
        if (valid() && loaded) await load();
      });
      if (getMember()?.role !== "guest") {
        const form = el("form", "board-reply-form"), text = el("textarea");
        text.maxLength = 2e3;
        text.rows = 1;
        text.required = true;
        text.placeholder = "回复内容…";
        text.setAttribute("aria-label", "回复 " + post.title);
        const send = el("button", "publish-button", "回复");
        form.append(text, send);
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (send.disabled) return;
          send.disabled = true;
          try {
            await request("/api/v1/posts/" + post.id + "/replies", "POST", { body: text.value.trim() });
            if (!valid()) return;
            text.value = "";
            post.replyCount++;
            replyLabel.textContent = "回复 " + post.replyCount;
            await load();
          } catch (error) {
            if (valid()) message.textContent = error.message;
          } finally {
            send.disabled = false;
          }
        });
        panel.append(form);
      }
      host.append(toggle, panel);
    };
    draw.refresh = () => Promise.all([...readers].map((read) => read()));
    draw.reset = () => readers.clear();
    return draw;
  };
})();
