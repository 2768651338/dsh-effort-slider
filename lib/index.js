//#region src/index.ts
/**
* dsh-effort-slider 宿主半区。
* 纯浏览器插件：所有功能都在客户端半区（拦截模型菜单 + Effort 面板），
* 宿主侧不注册任何路由/设置命名空间，仅保留稳定插件名。
*/
/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
const name = "ui-effort-slider";
/** 宿主插件体：空操作（保持 cordis 插件形态，便于行内注入与热更新）。 */
function apply() {}
//#endregion
export { apply, name };
