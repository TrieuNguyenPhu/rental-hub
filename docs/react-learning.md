# React trong bài EstateFlow

Tài liệu này nối các khái niệm React với mã nguồn đang chạy. React dựng giao diện; TypeScript mô tả dữ liệu; Zustand giữ dữ liệu dùng chung; các hàm trong `domain/` kiểm tra quy tắc nghiệp vụ. Không cần dùng đủ mọi Hook để hoàn thành bài.

## Khái niệm cơ bản

| Khái niệm | Cách hoạt động | Áp dụng trong bài và lý do |
| --- | --- | --- |
| Component | Hàm nhận props và trả về JSX. React gọi lại hàm khi dữ liệu nó dùng thay đổi. | `DashboardPage`, `RoomForm`, `Modal`, `Badge` chia giao diện theo nhiệm vụ. `BookingCustomerCell` và `BookingRoomCell` dùng chung cho bảng dashboard và bảng booking để một thay đổi cách hiển thị có hiệu lực ở cả hai nơi. |
| Props | Dữ liệu cha truyền xuống con trong mỗi lần render; component con không sửa props. | `BookingForm` nhận `rooms`, `buildings`, `onSave`, `onClose`; các cell booking nhận dữ liệu cần hiển thị. Callback trong props cho phép component dùng lại mà không chứa nghiệp vụ riêng của từng trang. |
| State | Dữ liệu React ghi nhớ giữa các lần render; gọi hàm cập nhật sẽ yêu cầu render lại. | `query`, `status`, `editing` thuộc từng trang vì chỉ trang đó cần. Danh sách tòa nhà, phòng, booking ở Zustand vì nhiều trang cùng đọc và thay đổi. Danh sách đã lọc được tính từ state khi render, không lưu thêm một bản state dễ lệch. |
| Event handling | Truyền hàm cho `onClick`, `onChange`, `onSubmit` để xử lý hành động người dùng. | `SearchInput` chuyển giá trị nhập lên trang; `FormPanel` đọc `FormData` khi submit; trang gọi action và xử lý kết quả. Validation cuối cùng nằm trong `domain/`, không phụ thuộc vào sự kiện UI. |
| Conditional rendering | Dùng `if`, `? :`, `&&` để chọn phần JSX cần hiện. | Trang danh sách hiện bảng hoặc `EmptyState`; `AwsAdminGate` hiện đăng nhập hoặc nội dung; modal chỉ được tạo khi có đối tượng đang sửa/xóa. |

## Hooks

Hook được gọi ở đầu component hoặc custom Hook, theo cùng thứ tự ở mọi lần render. Không gọi Hook bên trong điều kiện, vòng lặp hay event handler.

| Hook | Chức năng, cách hoạt động | Khi phù hợp | Trong bài |
| --- | --- | --- | --- |
| `useState` | Giữ giá trị riêng của một instance component; setter yêu cầu React render lại với giá trị mới. | Giá trị input, bộ lọc, dialog, trạng thái gửi form. | Các trang dùng cho tìm kiếm/bộ lọc/modal; `AwsAdminGate` dùng cho trạng thái đăng nhập; `ImageUploader` dùng cho tiến trình và lỗi. |
| `useEffect` | Chạy sau khi React cập nhật giao diện để đồng bộ với hệ thống ngoài React; hàm trả về dùng để dọn dẹp trước lần chạy tiếp theo hoặc khi unmount. | Kết nối API, DOM, timer, subscription cần setup/cleanup. | `Modal` gọi `showModal`, đóng dialog và trả focus; `ImageUploader` hủy upload khi unmount. Không dùng effect để lọc danh sách hay xử lý cú nhấp chuột. |
| `useRef` | Giữ cùng một đối tượng qua các lần render; thay đổi `.current` không gây render. | Giữ DOM node hoặc handle của tác vụ ngoài React. | `Modal` giữ tham chiếu `<dialog>`; `ImageUploader` giữ `AbortController` để hủy request. |
| `useContext` | Đọc giá trị từ provider gần nhất và render lại khi giá trị context đổi. | Truyền dependency dùng rộng mà không chuyển props qua nhiều lớp trung gian. | `useServices` đọc store, phiên admin và hàm upload từ `ServicesProvider`. Dữ liệu danh sách được theo dõi qua selector của Zustand, không sao chép vào context. |
| `useMemo` | Giữ kết quả phép tính giữa các lần render cho đến khi dependency đổi. | Phép tính thật sự tốn kém hoặc cần giữ tham chiếu cho component đã tối ưu. | Chưa dùng: các danh sách của MVP nhỏ, phép lọc trực tiếp dễ hiểu hơn; chỉ thêm sau khi đo thấy render chậm. |
| `useCallback` | Giữ cùng tham chiếu hàm giữa các lần render cho đến khi dependency đổi. | Truyền callback cho component được `memo` hoặc dùng callback làm dependency ổn định của Hook khác. | Chưa dùng: các handler hiện ngắn và component con chưa cần tối ưu theo tham chiếu. |
| `useReducer` | Giữ state và cập nhật bằng `dispatch(action)` qua một hàm reducer. | State cục bộ có nhiều chuyển trạng thái liên quan, ví dụ form nhiều bước với các nhánh chuyển trạng thái rõ ràng. | Chưa dùng: state cục bộ hiện độc lập; nghiệp vụ CRUD đã ở domain và Zustand. Thêm reducer lúc này sẽ lặp logic. |
| Custom Hook | Hàm bắt đầu bằng `use`, gọi các Hook khác để chia sẻ logic có state/subscription; mỗi nơi gọi có vòng đời riêng. | Nhiều component cần cùng một cách truy cập hoặc cùng logic tương tác. | `useServices` và `useEstateStore` trong `AppContext.ts` che chi tiết context/Zustand cho UI. Mỗi trang dùng selector để chỉ theo dõi các phần dữ liệu mình cần. |

`ImageUploader` còn dùng `useId` để tạo ID ổn định nối label và mô tả với input, tránh trùng ID khi có nhiều instance.

## Luồng chạy và lựa chọn triển khai

1. `main.tsx` tạo persistence, Zustand store, admin và upload adapter rồi truyền qua `App`.
2. `App.tsx` đặt `ServicesProvider`, router chọn trang; `Layout` hiển thị điều hướng và `<Outlet>`.
3. Trang đọc dữ liệu qua `useEstateStore(selector)`. Selector chọn riêng `buildings`, `rooms`, `bookings` hoặc action, nên một thay đổi không liên quan không bắt trang render lại chỉ vì đã chọn toàn bộ store.
4. Trang truyền dữ liệu và callback qua props cho form, dialog và các component hiển thị. Phần khách/phòng của booking được dùng chung giữa hai bảng; mỗi trang vẫn quyết định dữ liệu và thao tác của mình.
5. Khi submit, trang gọi action của store. `domain/validation.ts` và `domain/estateActions.ts` kiểm tra rồi cập nhật dữ liệu bất biến. `store.ts` lưu thay đổi qua persistence; component đang theo dõi phần dữ liệu đó render lại.

Form dùng `FormData` cho phần lớn trường chỉ cần đọc lúc submit. Riêng `RoomForm` dùng `useState` cho tòa nhà được chọn vì giới hạn tầng và gợi ý cần đổi ngay khi người dùng chọn tòa nhà. Bộ lọc được tính trực tiếp trong render: đây là dữ liệu dẫn xuất, không cần `useEffect` hay một state thứ hai. `Modal` dùng effect/ref vì `<dialog>` và focus là API của trình duyệt nằm ngoài JSX.

## Vai trò thư mục và file chính

| Nơi | Vai trò |
| --- | --- |
| `apps/web/src/main.tsx` | Điểm khởi tạo ứng dụng và nối adapter thật. |
| `apps/web/src/App.tsx` | Provider, routes, cổng đăng nhập admin tùy cấu hình. |
| `apps/web/src/AppContext.ts` | Context và custom Hooks `useServices`, `useEstateStore`. |
| `apps/web/src/store.ts` | Zustand state, actions và lưu dữ liệu khi danh sách đổi. |
| `apps/web/src/pages/` | Bốn màn hình: `DashboardPage` tổng quan, `BuildingsPage` quản lý tòa nhà, `RoomsPage` quản lý phòng, `BookingsPage` quản lý lịch. Trang giữ state UI và nối sự kiện với actions. |
| `apps/web/src/components/` | Các phần giao diện dùng lại: `Layout`, form, `Modal`, `ConfirmDialog`, `ImageUploader`, `Badge`, các phần trang trong `PageParts.tsx` và cell trong `BookingDetails.tsx`. |
| `apps/web/src/domain/` | Quy tắc ngày, kiểm tra dữ liệu, chồng lịch, actions CRUD, dữ liệu demo và hợp đồng với adapter. Không chứa React. |
| `apps/web/src/services/` | Adapter localStorage, AWS Cognito/S3 và HTTP upload ảnh. |
| `apps/web/src/utils/` | Định dạng ngày/tiền và đọc trường `FormData`; không chứa state. |
| `apps/web/src/index.css`, `fonts.css`, `public/` | Giao diện CSS và tài nguyên tĩnh. |
| `packages/domain/models.ts` | Kiểu dữ liệu dùng chung giữa web và media. |
| `apps/media/src/` | API Node xử lý, lưu và phục vụ ảnh; không phải React. |
| `tests/unit/`, `tests/e2e/`, `tests/architecture/`, `tests/media/` | Kiểm tra nghiệp vụ, thao tác trình duyệt, ranh giới phụ thuộc và xử lý media. |
| `docs/`, `infra/`, `ops/` | Tài liệu, cấu hình hạ tầng và quy trình triển khai. |

## Cách tự kiểm chứng và trình bày

- Mở từng route, thử thêm/sửa/xóa, tìm kiếm và lọc. Quan sát: thao tác đổi state, React render lại phần đang dùng dữ liệu đó, còn action từ chối dữ liệu sai.
- Giải thích vì sao `query` nằm trong trang, còn `bookings` nằm trong Zustand; vì sao dữ liệu lọc không thành state riêng; vì sao dialog cần effect/ref.
- Chạy `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; với Chrome/Chromium sẵn có, chạy thêm `npm run test:e2e`.

Nguồn chính: [React Quick Start](https://react.dev/learn), [Hooks reference](https://react.dev/reference/react/hooks), [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect), [Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks).
