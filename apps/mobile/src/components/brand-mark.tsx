import { View } from "react-native";
import Logo from "../../assets/dayotter-icon.svg";

/**
 * The DayOtter otter mark for the mobile app - renders the shared icon SVG,
 * cropped so the rounded tile fills the box (matches the web BrandMark).
 */
export function BrandMark({ size = 22 }: { size?: number }) {
  const inner = Math.round(size * 1.47); // crop the icon's transparent padding
  const offset = Math.round((inner - size) / 2);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.23),
        overflow: "hidden",
      }}
    >
      <Logo width={inner} height={inner} style={{ marginLeft: -offset, marginTop: -offset }} />
    </View>
  );
}
