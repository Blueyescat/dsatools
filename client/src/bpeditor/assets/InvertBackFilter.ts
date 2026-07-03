import { Filter, GlProgram, GpuProgram } from "pixi.js"

class InvertBackFilter extends Filter {
	constructor() {
		const glProgram = GlProgram.from({
			vertex: `
				in vec2 aPosition;
				out vec2 vTextureCoord;
				uniform vec4 uInputSize;
				uniform vec4 uOutputFrame;
				uniform vec4 uOutputTexture;
				vec4 filterVertexPosition(void) {
					vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
					position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
					position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
					return vec4(position, 0.0, 1.0);
				}
				vec2 filterTextureCoord(void) {
					return aPosition * (uOutputFrame.zw * uInputSize.zw);
				}
				void main(void) {
					gl_Position = filterVertexPosition();
					vTextureCoord = filterTextureCoord();
				}
			`,
			fragment: `
				in vec2 vTextureCoord;
				uniform sampler2D uBackTexture;
				uniform sampler2D uTexture;
				void main(void) {
					vec4 back = texture(uBackTexture, vTextureCoord);
					vec4 fore = texture(uTexture, vTextureCoord);
					gl_FragColor = fore.a == 0.0 ? vec4(0.0) : vec4(1.0 - back.rgb, back.a);
				}
			`
		})

		const gpuSource = `
			struct GlobalFilterUniforms {
				uInputSize:vec4<f32>,
				uInputPixel:vec4<f32>,
				uInputClamp:vec4<f32>,
				uOutputFrame:vec4<f32>,
				uGlobalFrame:vec4<f32>,
				uOutputTexture:vec4<f32>,
			};
			@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
			@group(0) @binding(2) var uSampler: sampler;
			@group(0) @binding(3) var uBackTexture: texture_2d<f32>;
			struct VSOutput {
				@builtin(position) position: vec4<f32>,
				@location(0) uv: vec2<f32>
			};
			fn filterVertexPosition( aPosition:vec2<f32> ) -> vec4<f32> {
				var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;

				position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
				position.y = position.y * (2.0*gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;

				return vec4(position, 0.0, 1.0);
			}
			fn filterTextureCoord( aPosition:vec2<f32> ) -> vec2<f32> {
				return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
			}
			fn globalTextureCoord( aPosition:vec2<f32> ) -> vec2<f32> {
				return (aPosition.xy / gfu.uGlobalFrame.zw) + (gfu.uGlobalFrame.xy / gfu.uGlobalFrame.zw);
			}
			@vertex
			fn mainVertex( @location(0) aPosition: vec2<f32> ) -> VSOutput {
				return VSOutput(filterVertexPosition(aPosition), filterTextureCoord(aPosition));
			}
			@fragment
			fn mainFragment( @location(0) uv: vec2<f32> ) -> @location(0) vec4<f32> {
				var back = textureSample(uBackTexture, uSampler, uv);
				return vec4<f32>(1.0 - back.rgb, back.a);
			}
		`

		super({
			glProgram,
			gpuProgram: GpuProgram.from({
				vertex: { source: gpuSource, entryPoint: "mainVertex" },
				fragment: { source: gpuSource, entryPoint: "mainFragment" },
			}),
			blendRequired: true,
			resolution: "inherit"
		})
	}
}

export const filterInvertBack = new InvertBackFilter()
